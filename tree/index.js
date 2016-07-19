/**
 * baidu gitlab tree plugin
 */

(function (global, $) {

    var private_token,
        project_id,
        repository_ref,
        apiTree,
        apiFile,
        apiProject,
        path_with_namespace,
        $tree,
        timer;

    function getRegExp(match, pattern) {
        if (match.match(pattern)) {
            return match.match(pattern)[1];
        }
        else {
            throw new Error("match nothing")
        }
    }

    var removeElement = function(index, array){

        if (index >= 0 && index < array.length) {
            for (var i = index; i < array.length; i++) {
                array[i] = array[i + 1];
            }
            array.length = array.length - 1;
        }
        return array;
    }

    var revertPath = function(revertedPathString) {

        var retString = '';
        var arrString = revertedPathString.split('/');

        // 1 删除空元素
        arrString.forEach(function(item, index){
            if (item === '') {
                removeElement(index, arrString);
            }
        });

        // 2.倒序排列
        for (var i = arrString.length - 1; i >= 0; i--) {
            var item = arrString[i];
            retString += item + '/';
        };

        // 3.去掉最后一个/
        if (retString.substr(retString.length - 1) === '/') {
            retString = retString.substr(0, retString.length - 1);
        }

        return retString;
    }

    var GitTree = function () {
        if (window.location.origin.match('gitlab')) {
            timer = setInterval(function () {
                if (window.location.href.match(/tree|blob/i)) {
                    clearInterval(timer);
                    initTree()
                    $(document).delegate('.project-navigation a, .content-wrapper a', 'click', function (e) {
                        clearInterval(timer);
                        timer = setInterval(function () {
                            if (window.location.href.match(/tree|blob/i)) {
                                clearInterval(timer);
                                initTree();
                            }
                        }, 800)
                    })
                }
            }, 800)
        }
    }

    function initTree () {

        private_token = getToken();
        if (!private_token) {
            throw new Error("Can't find private_token!")
            return;
        }

        createBtn();
        initVariables();
        action();
    }

    function getToken() {
        if ($('head script[type="text/javascript"]').contents()[0]) {
            var userInfo = $('head script[type="text/javascript"]').contents()[0].wholeText;
        }
        else if ($('body script').contents()[0]) {
            userInfo = $('body script').contents()[0].wholeText;
        }

        if (!userInfo) return;

        return getRegExp(userInfo, /gon.api_token="(.+)"/i);
    }

    function createBtn() {

        var htmlTemplate = '<div class="tree-btn fa fa-angle-left"></div>';
        $('body').append(htmlTemplate);
        hackStyle(true);

        $('.tree-btn').click(function() {
            if ($('.tree-btn').hasClass('fa-angle-right')) {
                $('.tree-btn').css('left', '180px').removeClass('fa-angle-right').addClass('fa-angle-left');
                showTree(true);
                hackStyle(true);
            }
            else {
                $('.tree-btn').css('left', '1px').removeClass('fa-angle-left').addClass('fa-angle-right');
                showTree(false);
                hackStyle(false);
            }
        });
    }

    function initVariables() {

        if (!$('input[name=project_id]')) return;
        project_id =  $('input[name=project_id]').val();
        repository_ref = $('.shortcuts-tree').attr('href').split('/').pop();
        path_with_namespace = $('.shortcuts-project').attr('href');

        apiProject = window.location.origin + '/api/v3/projects/';
        apiFile = apiProject + project_id + '/repository/files';
        apiTree = apiProject + project_id  + '/repository/tree';
        localStorage.removeItem('loadedDirs');
    }

    function showTree(boolean) {
        boolean ? $('.git-tree').show('fast') : $('.git-tree').hide('fast');
    }

    function getClickedFilePath (data) {
        var path = data.node.text + '/';
        var arrParents = data.node.parents;

        arrParents.forEach(function(item) {
            if (item !== '#') {
                var tmpText = $tree.jstree(true).get_text(item);
                path += tmpText + '/';
            }
        });

        path = revertPath(path);

        return window.location.origin + '/' + path_with_namespace + '/blob/' + repository_ref + '/' + path;
    }

    function action() {
        $.get(apiTree, {private_token: private_token, ref_name: repository_ref})
            .done(function (data) {
                // console.log(apiTree)
                createTree(data);
                selectNode();
            })
    }


    function createTree(data) {

        var htmlTemplate = '<div class="git-tree">' +
            '<div class="tree-header">' +
            '<div class="info">' +
            '<i class="fa fa-lock"></i>' +
            '<a href="' + path_with_namespace + '" target="_blank">' +
            '<span>' + path_with_namespace + '</span>' +
            '</a>' +
            '</div>' +
            '<i class="fa fa-code-fork"></i>' +
            '<span class="branch">' + repository_ref + '</span>' +
            '</div>' +
            '<nav class="file-nav"></nav>' +
            '</div>';

        $('body').append(htmlTemplate);

        var subTreeData = [];

        data.forEach(function(item) {
            var singleObj = {};
            singleObj.text = item.name;
            if (item.type === 'tree') {
                singleObj.children = null;
                singleObj.data = 'tree';
                singleObj.icon = 'fa fa-folder';
            }
            else if (item.type === 'blob') {
                singleObj.icon = 'fa fa-file-o';
                singleObj.data = 'blob';
            }

            subTreeData.push(singleObj);
        });

        // 实例化一棵树
        $tree = $('.git-tree nav').jstree({
            core: {
                'data': subTreeData,
                'check_callback': true
            },
            plugins: ['wholerow']
        });
    }

    function hackStyle(boolean) {
        boolean ? $('header.navbar').css('padding-left', '230px') : $('header.navbar').css('padding-left', '0');
    }

    function selectNode() {
        $tree.on("select_node.jstree", function(e, data) {

            var selectNode = $tree.jstree('get_selected');

            if (data && data.node && data.node.data == 'tree') {
                var path = data.node.text;
                var currentNodeId = data.node.id;
                var parentNode = $tree.jstree(true).get_parent(currentNodeId);

                // 获取select节点+ 父节点的text
                var currentNodeText = data.node.text;
                var arrParents = data.node.parents;

                path = currentNodeText + '/';

                // 获取当前select节点+所有父节点的text  ["j1_13", "j1_3", "#"]
                arrParents.forEach(function (item) {
                    if (item !== '#') {
                        var tmpText = $tree.jstree(true).get_text(item);
                        path += tmpText + '/';
                    }
                });

                path = revertPath(path);

                var arrClickedDir = localStorage.getItem('loadedDirs');
                if (arrClickedDir) {
                    arrClickedDir = arrClickedDir.split(',');
                }

                if (arrClickedDir && arrClickedDir.indexOf(path) > -1) {
                    pjax(data);
                    return;
                }

                $.get(apiTree, {
                    private_token: private_token,
                    id: project_id,
                    path: path,
                    ref_name: repository_ref
                }, function (result) {
                    var arrClickedDir = localStorage.getItem('loadedDirs');
                    if (arrClickedDir) {
                        arrClickedDir = arrClickedDir.split(',');
                        arrClickedDir.push(path);
                    }

                    if (arrClickedDir && Array.isArray(arrClickedDir)) {
                        localStorage.setItem('loadedDirs', arrClickedDir.join(','));
                    } else {
                        localStorage.setItem('loadedDirs', path);
                    }

                    result.forEach(function (item) {
                        var singleObj = {};
                        singleObj.text = item.name;

                        if (item.type === 'tree') {
                            singleObj.children = null;
                            singleObj.data = 'tree';
                            singleObj.icon = 'fa fa-folder';
                        }
                        else if (item.type === 'blob') {
                            singleObj.icon = 'fa fa-file-o';
                            singleObj.data = 'blob';
                        }
                        $tree.jstree(true).create_node(selectNode, singleObj, 'last');
                    });

                    $tree.jstree(true).open_node(selectNode);
                    pjax(data);
                });
            }
            else {
                pjax(data);
            }
        })
    }

    function pjax(data) {
        $.pjax({
            url: getClickedFilePath(data),
            container: '#tree-content-holder',
            fragment: '#tree-content-holder',
            timeout: 9000,
            cache: false
        });
    }

    /* CommonJS */
    if (typeof require === 'function' && typeof module === 'object' && module && typeof exports === 'object' && exports)
        module.exports = GitTree;
    /* AMD */
    else if (typeof define === 'function' && define['amd'])
        define(function () {
            return GitTree;
        });
    /* Global */
    else
        global['GitTree'] = global['GitTree'] || GitTree;

})(window || this, jQuery);

if (jQuery) {
    new GitTree();
}
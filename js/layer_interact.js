/*
 * layer_interact.js
 */

YUI().use("node", "transition", function(Y) {
    Y.namespace("vividLayer");

    // 判断是否支持animation
    Y.vividLayer.animation = (function() {
        var animation = false,
            animationstring = 'animation',
            keyframeprefix = '',
            domPrefixes = 'Webkit Moz O ms Khtml'.split(' '),
            pfx = '',
            elm = Y.Node.create("<div></div>").getDOMNode();

        if (elm.style.animationName !== undefined) {
            animation = true;
        }

        if (animation === false) {
            for (var i = 0; i < domPrefixes.length; i++) {
                if (elm.style[domPrefixes[i] + 'AnimationName'] !== undefined) {
                    pfx = domPrefixes[i];
                    animationstring = pfx + 'Animation';
                    keyframeprefix = '-' + pfx.toLowerCase() + '-';
                    animation = true;
                    break;
                }
            }
        }

        return animation;
    }());

    // special效果2 重力和抛东西
    Y.vividLayer.specialEffect2 = function(layerNode) {
        var Constants = {
            LAYER_TITLE_CLASS: "layer_title",
            FRICTION: 0.95,
            GRAVITY: 1,
            COLLISION: - 0.95,
            FORCE: 2,

            // 限制，如果在这个帧数内，元素的位置没有发生变化，则认为元素已经停止 
            COUNT_LIMIT: 20
        };

        var doc = Y.one(document),
            win = Y.one(window),
            body = Y.one("body"),
            layerWidth = 0,
            layerHeight = 0,
            dragOffsetX = 0,
            dragOffsetY = 0,
            newX = 0,
            newY = 0,
            oldX = 0,
            oldY = 0,
            deltaX = 0,
            deltaY = 0,
            edgeBox = null,
            groundGraphicNode = null,
            isDragging = false;

        // 工具函数 - 函数节流
        function throttle(fn, context) {
            var limitTime = 100;
            clearTimeout(fn.timeId);
            fn.timeId = setTimeout(function() {
                fn.call(context);
            }, limitTime);
        }

        // 图形，用来标识地面
        function createGround() {
            groundGraphicNode = Y.Node.create("<div></div>");
            groundGraphicNode.setStyles({
                position: "absolute",
                width: doc.get("winWidth"),
                height: 2,
                background: "#000",
                opacity: 0.2,
                left: 0,
                top: oldY + layerHeight,
                zIndex: 2000
            });
            groundGraphicNode.appendTo(body);
        }

        // 确定边界
        function setupEdge(){
            edgeBox = {
                top: doc.get("docScrollY"),
                bottom: parseInt(groundGraphicNode.getStyle("top")),
                left: 0,
                right: doc.get("winWidth")
            };
        }

        function updateLayerPos() {
            var properX = newX,
            properY = newY;

            if(properX < edgeBox.left){
                properX = edgeBox.left;
            } else if(properX > edgeBox.right - layerWidth){
                properX = edgeBox.right - layerWidth;
            }

            if(properY < edgeBox.top){
                properY = edgeBox.top;
            }else if(properY > edgeBox.bottom - layerHeight){
                properY = edgeBox.bottom - layerHeight;
            }

            layerNode.setXY([properX, properY]);
        }

        function handleDrag(event) {
            if (isDragging) {
                newX = event.pageX - dragOffsetX;
                newY = event.pageY - dragOffsetY;
                deltaX = newX - oldX;
                deltaY = newY - oldY;
                updateLayerPos();
                oldX = newX;
                oldY = newY;
            }
            event.preventDefault();
        }

        function setAnimationReady() {
            if (!window.requestAnimationFrame) {
                window.requestAnimationFrame = (function() {
                    return window.webkitRequestAnimationFrame ||
                        window.mozRequestAnimationFrame ||
                        window.oRequestAnimationFrame ||
                        window.msRequestAnimationFrame ||
                        function(callback, element) {
                            window.setTimeout(callback, 1000 / 60);
                    };
                })();
            }
        }

        // 在有重力的空间内自由运动
        function startFreeMove() {
            var layerPos = layerNode.getXY(),
                x = layerPos[0],
                y = layerPos[1],
                recordX = x,
                recordY = y,
                recordLastX = x,
                recordLastY  = y,
                count = 0,
                countLimit = Constants.COUNT_LIMIT,

                // 使用刚开始自由运动时，delta记录的数值作为初速度
                vx = deltaX * Constants.FORCE,
                vy = deltaY * Constants.FORCE,
                friction = Constants.FRICTION,
                gravity = Constants.GRAVITY,
                collision = Constants.COLLISION;

            // 自由运动的速度和边界判定
            function move(){
                var recordPos;

                if(x < edgeBox.left){
                    x = 0;
                    vx = vx * collision;
                } else if(x > edgeBox.right - layerWidth){
                    x = edgeBox.right - layerWidth;
                    vx = vx * collision;
                }

                if(y < edgeBox.top){
                    y = 0;
                    vy = vy * collision;
                }else if(y > edgeBox.bottom - layerHeight){
                    y = edgeBox.bottom - layerHeight;
                    vy = vy * collision;
                }
                layerNode.setXY([x, y]);
                recordPos = layerNode.getXY();
                recordX = recordPos[0];
                recordY = recordPos[1];
            }

            // 动画循环
            function animate() {
                    vy = vy + gravity;
                    x = x + vx;
                    y = y + vy;
                    vx *= friction;
                    vy *= friction;
                    move();
                    if(recordX === recordLastX && recordY === recordLastY){
                        count ++;
                    }else{
                        count = 0;
                        recordLastX = recordX;
                        recordLastY = recordY;
                    }
                    if(count > countLimit){
                        return endFreeMove();
                    }
                    if(isDragging){
                        return;
                    }
                    requestAnimationFrame(animate);
            }

            requestAnimationFrame(animate);
        }

        // 由于摩擦力和碰撞损耗而停止
        function endFreeMove() {
            if(groundGraphicNode){
                groundGraphicNode.remove();
                groundGraphicNode = null;
            }
        }

        function handleDocMouseup(event) {
            if (isDragging) {
                isDragging = false;
                doc.detach("mousemove", handleDrag);
                body.setStyle("cursor", "auto");
                startFreeMove();
            }
        }

        function handleLayerTitleMousedown(event) {
            var layerPos = layerNode.getXY();
            oldX = newX = layerPos[0];
            oldY = newY = layerPos[1];
            dragOffsetX = event.pageX - oldX;
            dragOffsetY = event.pageY - oldY;

            if(isDragging === false){
                if(groundGraphicNode === null){
                    createGround();
                    setupEdge();
                } 
                isDragging = true;
                doc.on("mousemove", handleDrag);
                body.setStyle("cursor", "move");
                event.preventDefault();
            }
        }

        function assignData() {
            var isHidden = layerNode.getStyle("display") === "none" ? true : false;
            if (isHidden) {
                layerNode.show();
            }
            layerWidth = layerNode.get("offsetWidth");
            layerHeight = layerNode.get("offsetHeight");
            if (isHidden) {
                layerNode.hide();
            }
        }

        function unbindEvents() {
            layerNode.detach();
            doc.detach("mouseup", handleDocMouseup);
        }

        function bindEvents() {
            layerNode.on("mousedown", handleLayerTitleMousedown);
            doc.on("mouseup", handleDocMouseup);
        }

        function init() {
            if (layerNode) {
                assignData();
                setAnimationReady();
                bindEvents();
            }
        }

        init();

        return {
            remove: function() {
                unbindEvents();
                endFreeMove();
            }
        };
    };

    // special效果1 弹性
    Y.vividLayer.specialEffect1 = function(layerNode) {
        var Constants = {
            LAYER_TITLE_CLASS: "layer_title",
            SPRING: 0.05,
            FRICTION: 0.9
        };

        var doc = Y.one(document),
            body = Y.one("body"),
            originGraphicNode = null,
            originX = 0,
            originY = 0,
            layerWidth = 0,
            layerHeight = 0,
            dragOffsetX = 0,
            dragOffsetY = 0,
            isDragging = false;

        // 这个创建层标识浮层原来的位置
        function createOriginGraphic() {
            originGraphicNode = Y.Node.create("<div></div>");
            originGraphicNode.setStyles({
                position: "absolute",
                width: layerWidth,
                height: layerHeight,
                background: "#000",
                opacity: 0.2,
                left: originX,
                top: originY,
                zIndex: 50
            });
            originGraphicNode.appendTo(body);
        }

        function updateLayerPos(layerX, layerY) {
            layerNode.setXY([layerX, layerY]);
        }

        function handleDrag(event) {
            if (isDragging) {
                var layerX = event.pageX - dragOffsetX,
                    layerY = event.pageY - dragOffsetY;

                updateLayerPos(layerX, layerY);
            }
            event.preventDefault();
        }

        function setAnimationReady() {
            if (!window.requestAnimationFrame) {
                window.requestAnimationFrame = (function() {
                    return window.webkitRequestAnimationFrame ||
                        window.mozRequestAnimationFrame ||
                        window.oRequestAnimationFrame ||
                        window.msRequestAnimationFrame ||
                        function(callback, element) {
                            window.setTimeout(callback, 1000 / 60);
                    };
                })();
            }
        }

        // 弹性运动到原位置
        function startSpringMove() {
            var layerPos = layerNode.getXY(),
                x = layerPos[0],
                y = layerPos[1],
                dx = 0,
                dy = 0,
                dl = 0,
                vx = 0,
                vy = 0,
                vxNext = 0,
                vyNext = 0,
                friction = Constants.FRICTION,
                spring = Constants.SPRING;

            // 弹性动画循环
            function animate() {
                dx = originX - x;
                dy = originY - y;
                dl = Math.sqrt(dx * dx + dy * dy);

                if (dl > 1) {
                    vxNext = vx + dx * spring;
                    vyNext = vy + dy * spring;
                    vx = vxNext;
                    vy = vyNext;
                    x = x + vx;
                    y = y + vy;
                    vx *= friction;
                    vy *= friction;
                    layerNode.setXY([x, y]);
                    requestAnimationFrame(animate);
                } else {
                    layerNode.setXY([originX, originY]);
                    endSpringMove();
                }
            }

            requestAnimationFrame(animate);
        }

        // 结束弹性动画
        function endSpringMove() {
            originGraphicNode.remove();
            originGraphicNode = null;
        }

        function handleDocMouseup(event) {
            if (isDragging) {
                isDragging = false;
                doc.detach("mousemove", handleDrag);
                body.setStyle("cursor", "auto");
                startSpringMove();
            }
        }

        function handleLayerTitleMousedown(event) {
            var layerPos = layerNode.getXY();
            originX = layerPos[0];
            originY = layerPos[1];
            dragOffsetX = event.pageX - originX;
            dragOffsetY = event.pageY - originY;

            if (originGraphicNode === null) {
                createOriginGraphic();
                isDragging = true;
                doc.on("mousemove", handleDrag);
                body.setStyle("cursor", "move");
            }
            event.preventDefault();
        }

        function assignData() {
            var isHidden = layerNode.getStyle("display") === "none" ? true : false;
            if (isHidden) {
                layerNode.show();
            }
            layerWidth = layerNode.get("offsetWidth");
            layerHeight = layerNode.get("offsetHeight");
            if (isHidden) {
                layerNode.hide();
            }
        }

        function unbindEvents() {
            layerNode.detach();
            doc.detach("mouseup", handleDocMouseup);
        }

        function bindEvents() {
            layerNode.delegate("mousedown", handleLayerTitleMousedown, "." + Constants.LAYER_TITLE_CLASS);
            doc.on("mouseup", handleDocMouseup);
        }

        function init() {
            if (layerNode) {
                assignData();
                setAnimationReady();
                bindEvents();
            }
        }

        init();

        return {
            remove: function() {
                unbindEvents();
            }
        };
    };

    // special效果0 初始 移动浮层
    Y.vividLayer.specialEffect0 = function(layerNode) {
        var Constants = {
            LAYER_TITLE_CLASS: "layer_title"
        };

        var doc = Y.one(document),
            body = Y.one("body"),
            dragGraphicNode = null,
            layerWidth = 0,
            layerHeight = 0,
            graphicOffsetX = 0,
            graphicOffsetY = 0,
            isDragging = false;

        function createDragGraphic(targetX, targetY) {
            dragGraphicNode = Y.Node.create("<div></div>");
            dragGraphicNode.setStyles({
                position: "absolute",
                left: targetX,
                top: targetY,
                width: layerWidth - 4,
                height: layerHeight - 4,
                border: "2px solid #9e9e9e",
                zIndex: 2000
            });
            dragGraphicNode.setData("winWidth", doc.get("winWidth"));
            dragGraphicNode.setData("winHeight", doc.get("winHeight"));
            dragGraphicNode.setData("scrollTop", doc.get("docScrollY"));
            dragGraphicNode.appendTo(body);
        }

        // 根据计算得到的位置，设置替换层的位置
        function updateGraphicPos(graphicX, graphicY) {
            var winWidth = dragGraphicNode.getData("winWidth"),
                winHeight = dragGraphicNode.getData("winHeight"),
                scrollTop = dragGraphicNode.getData("scrollTop"),
                properX = graphicX,
                properY = graphicY;

            if (properX < 0) {
                properX = 0;
            } else if (properX > winWidth - layerWidth) {
                properX = winWidth - layerWidth;
            }

            if (properY < scrollTop) {
                properY = scrollTop;
            } else if (properY > winHeight + scrollTop - layerHeight) {
                properY = winHeight + scrollTop - layerHeight;
            }

            dragGraphicNode.setXY([properX, properY]);
        }

        // 确定移动
        function executeMove() {
            var graphicPos = dragGraphicNode.getXY();
            layerNode.setXY([graphicPos[0], graphicPos[1]]);
        }

        function handleDrag(event) {
            if (isDragging) {
                var graphicX = event.pageX - graphicOffsetX,
                    graphicY = event.pageY - graphicOffsetY;

                updateGraphicPos(graphicX, graphicY);
            }
            event.preventDefault();
        }

        function handleDocMouseup(event) {
            if (isDragging) {
                isDragging = false;
                executeMove();
                doc.detach("mousemove", handleDrag);
                body.setStyle("cursor", "auto");
                dragGraphicNode.remove();
                dragGraphicNode = null;
            }
        }

        function handleLayerTitleMousedown(event) {
            var layerPos = layerNode.getXY();
            graphicOffsetX = event.pageX - layerPos[0];
            graphicOffsetY = event.pageY - layerPos[1];

            if (dragGraphicNode === null) {
                createDragGraphic(layerPos[0], layerPos[1]);
                isDragging = true;
                doc.on("mousemove", handleDrag);
                body.setStyle("cursor", "move");
            }

            event.preventDefault();
        }

        function assignData() {
            var isHidden = layerNode.getStyle("display") === "none" ? true : false;
            if (isHidden) {
                layerNode.show();
            }
            layerWidth = layerNode.get("offsetWidth");
            layerHeight = layerNode.get("offsetHeight");
            if (isHidden) {
                layerNode.hide();
            }
        }

        function unbindEvents() {
            layerNode.detach();
            doc.detach("mouseup", handleDocMouseup);
        }

        function bindEvents() {
            layerNode.delegate("mousedown", handleLayerTitleMousedown, "." + Constants.LAYER_TITLE_CLASS);
            doc.on("mouseup", handleDocMouseup);
        }

        function init() {
            if (layerNode) {
                assignData();
                bindEvents();
            }
        }

        init();

        return {
            remove: function() {
                unbindEvents();
            }
        };
    };

    // special切换
    Y.vividLayer.specialSetup = function() {
        var Constants = {
            LAYER_CLASS: "m_layer",
            SPECIAL_LINK_CLASS: "layer_special_link",
            SPECIAL_METHOD_PREFIX: "specialEffect",
            SPECIAL_CLASS_PREFIX: "special_status_",
            SKILL_HINT_CLASS: "skill_hint",
            SKILL_LIST_CLASS: "skill_list",
            SKILL_ITEM_CLASS: "skill_item",
            HINT_SPACE: 40,
            HINT_DURATION_1: 0.5,
            HINT_DURATION_2: 0.5,
            HINT_DELAY: 0.5,
        };

        var doc = Y.one(document),
            layerNodes = Y.all("." + Constants.LAYER_CLASS),
            specialNodes = Y.all("." + Constants.SPECIAL_LINK_CLASS),
            hintNode = Y.one("." + Constants.SKILL_HINT_CLASS),
            skillListNode = hintNode.one("." + Constants.SKILL_LIST_CLASS),
            skillItemNodes = hintNode.all("." + Constants.SKILL_ITEM_CLASS),
            currentLayerNode = null,
            isDragging = false,
            totalIndex = 2;

        // 以一个动画表示状态切换情况
        function showSkillHint(layerNode, prevIndex, nextIndex){
            var prevNode = skillItemNodes.item(prevIndex),
                nextNode = skillItemNodes.item(nextIndex),
                layerWidth = layerNode.get("offsetWidth"),
                layerHeight = layerNode.get("offsetHeight"),
                layerPos = layerNode.getXY(),
                layerX = layerPos[0],
                layerY = layerPos[1],
                hintX = layerX,
                hintY = 0,
                hintSpace = Constants.HINT_SPACE;

            if(layerY + layerHeight > doc.get("docScrollY") + doc.get("winHeight") - hintSpace * 2){
                hintY = layerY - hintSpace * 2;
            }else{
                hintY = layerY + layerHeight;
            }

            skillItemNodes.hide();
            prevNode.show();
            nextNode.show();

            hintNode.setStyles({
                left: hintX,
                top: hintY
            });

            skillListNode.setStyle("width", layerWidth);

            hintNode.show();

            prevNode.transition({
                duration: Constants.HINT_DURATION_1,
                easing: "ease-in-out",
                opacity: 0,
                top: 0,
                on: {
                    start: function(){
                        prevNode.setStyles({
                            top: hintSpace / 2,
                            opacity: 1
                        });
                    }
                }
            });

            nextNode.transition({
                duration: Constants.HINT_DURATION_1,
                easing: "ease-in-out",
                opacity: 1,
                top: hintSpace / 2 + "px",
                on: {
                    start: function(){
                        nextNode.setStyles({
                            top: hintSpace,
                            opacity: 0
                        });
                        IsHintRunning = true;
                    },
                    end: function(){
                        nextNode.transition({
                            duration: Constants.HINT_DURATION_2,
                            opacity: 0,
                            delay: Constants.HINT_DELAY
                        });
                    },
                }
            });
        }

        function setupHint(){
            skillItemNodes.setStyles({
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%"
            });
        }

        function updateSpecialType(layerNode, linkNode) {
            var specialIndex = layerNode.getData("specialIndex"),
                effectController = layerNode.getData("effectController"),
                prevIndex = specialIndex,
                nextIndex;

            // 更改效果指示灯状态
            linkNode.removeClass(Constants.SPECIAL_CLASS_PREFIX + specialIndex);

            specialIndex = specialIndex + 1;
            if (specialIndex > totalIndex) {
                specialIndex = 0;
            }

            nextIndex = specialIndex;
            showSkillHint(layerNode, prevIndex, nextIndex);

            // 清除前一个效果
            effectController.remove();

            // 添加下一个效果
            effectController = Y.vividLayer[Constants.SPECIAL_METHOD_PREFIX + specialIndex](layerNode);
            layerNode.setData("specialIndex", specialIndex);
            layerNode.setData("effectController", effectController);
            linkNode.addClass(Constants.SPECIAL_CLASS_PREFIX + specialIndex);
        }

        function handleSpecialClick(event) {
            var target = event.currentTarget,
                relatedLayerNode = target.ancestor("." + Constants.LAYER_CLASS);
            updateSpecialType(relatedLayerNode, target);
        }

        function handleSpecialMousedown(event){
            event.stopPropagation();
        }

        function bindEvents() {
            doc.delegate("click", handleSpecialClick, "." + Constants.SPECIAL_LINK_CLASS);
            specialNodes.on("mousedown", handleSpecialMousedown);
        }

        function init() {
            if (layerNodes.size()) {
                setupHint();
                bindEvents();
                // 初始浮层全部都是效果0
                layerNodes.each(function(layerNode) {
                    var effectController = Y.vividLayer.specialEffect0(layerNode);
                    layerNode.setData("specialIndex", 0);
                    layerNode.setData("effectController", effectController);
                });
            }
        }

        init();
    };

    Y.vividLayer.demoSetup = function() {
        var Constants = {
            EFFECTS_CLASS: "effects_select",
            LINK_CLASS: "effect_link",
            LAYER_ID: "demo-layer",
            LAYER_CLOSE_CLASS: "layer_close_link",
            LAYER_DECLARE_CLASS: "declare",
            MASK_CLASS: "layer_mask",
            IN_SUFFIX: "In",
            OUT_SUFFIX: "Out",
            DEFAULT_EFFECT_DURATION: 250
        };

        var doc = Y.one(document),
            effectNode = Y.one("." + Constants.EFFECTS_CLASS),
            layerNode = Y.one("#" + Constants.LAYER_ID),
            layerCloseNode = layerNode.one("." + Constants.LAYER_CLOSE_CLASS),
            layerDeclareNode = layerNode.one("." + Constants.LAYER_DECLARE_CLASS),
            maskNode = null,
            effectName = "",
            InEffectClass = "",
            outEffectClass = "",
            endFlag = null,
            isLayerShowed = false;

        function createMask() {
            maskNode = Y.Node.create("<div></div>");
            maskNode.addClass(Constants.MASK_CLASS);
            maskNode.appendTo("body");
        }

        function closeLayer() {
            layerNode.hide();
            layerNode.removeClass(outEffectClass);
            maskNode.hide();
            isLayerShowed = false;
            endFlag = null;
        }

        function showLayer() {
            var properX = 0,
                properY = 0;
            if (maskNode === null) {
                createMask();
            } else {
                maskNode.show();
            }
            layerDeclareNode.setHTML("Effect: <em>" + effectName + "</em>");
            layerNode.show();
            properX = (layerNode.get("winWidth") - layerNode.get("offsetWidth")) / 2;
            properY = (layerNode.get("winHeight") + layerNode.get("docScrollY") - layerNode.get("offsetHeight")) / 2;
            layerNode.setXY([properX, properY]);
            isLayerShowed = true;
            layerNode.addClass(InEffectClass);
        }

        function handleClose(event) {
            if (endFlag === null && maskNode !== null && isLayerShowed) {
                layerNode.removeClass(InEffectClass);
                layerNode.addClass(outEffectClass);
                if (Y.vividLayer.animation) {
                    endFlag = setTimeout(closeLayer, Constants.DEFAULT_EFFECT_DURATION);
                } else {
                    closeLayer();
                }
            }
            event.preventDefault();
        }

        function handleLinkClick(event) {
            var target = event.currentTarget,
                targetValue = target.get("text");

            event.stopPropagation();

            if (!isLayerShowed) {
                InEffectClass = targetValue + Constants.IN_SUFFIX;
                outEffectClass = targetValue + Constants.OUT_SUFFIX;
                effectName = targetValue;
                showLayer();
            }
        }

        function bindEvents() {
            effectNode.delegate("click", handleLinkClick, "." + Constants.LINK_CLASS);
            layerCloseNode.on("click", handleClose);
        }

        function init() {
            if (effectNode) {
                bindEvents();
            }
        }

        init();
    };

    Y.vividLayer.specialSetup();
    Y.vividLayer.demoSetup();
});
/*blobal sjs */
sjs.module({
required:[
	{ Inheritance   : '/{sjshome}/modules/splice.inheritance.js'},
	{ Animation	    : '/{sjshome}/modules/splice.animation.js'},
	{ Component		: '/{sjshome}/modules/splice.component.core.js'},
	{ Data			: '/{sjshome}/modules/splice.dataitem.js'},
	{ Events		: '/{sjshome}/modules/splice.event.js'},
	{ Views			: '/{sjshome}/modules/splice.view.js'}
],
definition:function component(scope){
	//enable strict mode
	"use strict";

	// importing framework features makes our code less verbose
	var debug = scope.sjs.log.debug
	,   log = scope.sjs.log
    ,   imports = scope.imports
    ;
    
	var
	    Class 			= imports.Inheritance.Class
	,   Animate 		= imports.Animation.Animate
	,   Controller 	    = imports.Component.Controller
	,	Event 			= imports.Events.Event
	,	event 			= imports.Events.event
	,	View 			= imports.Views.View
	,	DataItem 		= imports.Data.DataItem
    ,   ArrayDataItem   = imports.Data.ArrayDataItem 
    ,   IDataContract   = imports.Data.IDataContract
	;


	/**
	* Create a DataItem object with onChanged event
	*/
	var ObservableDataItem = function ObservableDataItem(data){
		return event(new DataItem(data)).attach({
			onChanged : event.multicast
		});
	};


	/**
	 * Base UIControl class
	 */
	var UIControl = Class(function UIControl(args){
		this.base(args);
        
        if(args)
            this.observeDataItem = args.observeDataItem;

		event(this).attach({
			onDataOut  : event.multicast,
			onReflow : event.multicast
		});


		if(this.isHidden) {
			this.prevDisplayState = this.elements.root.style.display;
			this.elements.root.style.display = 'none';
		}
		this.dataItem = null;

	}).extend(Controller).implement(IDataContract);

	UIControl.prototype.hide = function(){
		var self = this;

		if(this.isHidden) return;

		this.prevDisplayState = this.elements.root.style.display;

		if(this.animate){
			Animate(this.elements.root).opacity(100, 0, 300,function(){
				self.elements.root.style.display = 'none';
			});
		}
		else {
			this.elements.root.style.display = 'none';
		}
		this.isHidden = true;
	};

	UIControl.prototype.show = function(){
		if(!this.isHidden) return;
		if(this.animate) {
			this.elements.root.style.opacity = 0;
		}

		if(!this.prevDisplayState) this.prevDisplayState = 'inline';

		this.elements.root.style.display = this.prevDisplayState;

		if(this.animate) {
			Animate(this.elements.root).opacity(0, 100, 300);
		}
		this.isHidden = false;
	};

	UIControl.prototype.changeState = function(args){
		if(args && args.isHidden)
			this.hide();
		else
			this.show();
	};
	/* Data Contract */
	/*!!!!! make sure to unsubscribe when data items changes */
	UIControl.prototype.dataIn = function(item){

		if(item instanceof DataItem) {
				if(this.dataItem === item) {
                    if(this._sjs_di_lastchange == this.dataItem._change) return;
					this.onDataIn(this.dataItem);
                    this._sjs_di_lastchange = this.dataItem._change;
					return;
				}

				this.dataItem = item.path(this.dataPath);
                if(this.observeDataItem === true){
                    if(!this.dataItem.onChanged){
                        event(this.dataItem).attach({
				            onChanged : event.multicast
		                });                
                    }
                    this.dataItem.onChanged.subscribe(function(dataItem){
                        if(this._sjs_di_lastchange == dataItem._change) return;
                        this.onDataIn(dataItem);
                        this._sjs_di_lastchange = dataItem._change;
                    },this);
                }

				this.onDataIn(this.dataItem);
                 this._sjs_di_lastchange = this.dataItem._change;
			return;
		}
		// datapath is only set externally
		this.dataItem = (new DataItem(item)).path(this.dataPath);
		event(this.dataItem).attach({
				onChanged : event.multicast
		});
		// invoke data-item handler
		this.onDataIn(this.dataItem);
        this._sjs_di_lastchange = this.dataItem._change;
        
	};


	UIControl.prototype.onDataIn = function(data){
		this.onDataOut(data);
	};

	UIControl.prototype.initialize = function(){
		var fn = sjs.fname(this.constructor)
		if(fn === 'UIControl') return;
		console.warn(fn + '.initialize is not implemented');
	};





	/**
	 * Called by the layout manager or a parent view when container dimensions changed and
	 * layout update is required
	 * @param {position: {left:{number}, top:{Number}}} - top left corner position
	 * @param {size: {width:{Number}, height:{Number}}} - parent container' dimensions
	 * */
	UIControl.prototype.reflow = function(position,size,bubbleup){
		if(!this.views || !this.views.root) return;

		if(bubbleup == true) {
			this.reflowChildren(null,null,bubbleup);
			return ;
		}




		// Get style object once and apply settings
		if(this.layout !== 'css') {
			var style = this.views.root.htmlElement.style;

			style.left 		= position.left +'px';
			style.top  		= position.top + 'px';

			style.width  	= size.width + 'px';
			style.height 	= size.height + 'px';
		}

		if(this._lastWidth != size.width || this._lastHeight != size.height ) {
			this.reflowChildren(position,size,bubbleup);
		}

		this._lastWidth = size.width;
		this._lastHeight = size.height;

		this.onReflow(position,size);

	};

	UIControl.prototype.reflowChildren = function(position, size,bubbleup){

		for(var i=0; i<this.__sjs_visual_children__.length; i++){
			if(typeof this.__sjs_visual_children__[i].reflow !== 'function') continue;
			this.__sjs_visual_children__[i].reflow(position,size,bubbleup);
		}
	};



	//returns zero or a value
	function z(n){
		if(!n) return 0;
		return n;
	}

	/**
	 * HTML Element decorator
	 */
	var UIElement = Class(function UIElement(args){
		this.base();
		event(this).attach({onClick : event.multicast});
	}).extend(UIControl);

	UIElement.prototype.initialize = function(){
		event(this.views.root).attach({onclick : event.unicast})
		.onclick.subscribe(function(){this.onClick(this);}, this);
	};


	/*
		Element positioning utilies
	*/
	var Positioning =  {

		//@ Take mouse event object to return mouse position coordinates
	  mouse:function(e){
		  //http://www.quirksmode.org/js/events_properties.html#position
			var posx = 0;
			var posy = 0;
			if (!e) var e = window.event;
			if (e.pageX || e.pageY) 	{
				posx = e.pageX;
				posy = e.pageY;
			}
			else if (e.clientX || e.clientY) 	{
				posx = e.clientX + document.body.scrollLeft
					+ document.documentElement.scrollLeft;
				posy = e.clientY + document.body.scrollTop
					+ document.documentElement.scrollTop;
			}
			return {x:posx,y:posy};
	  },

    /*
    	Returns element coordinates in
    	document.body coordinate space
    */
    abs: function(obj) {
      var n = obj;
			if(obj instanceof View)
				n = obj.htmlElement;
			var location  = [0,0];

    	while (n != undefined) {
            location[0] += z(n.offsetLeft);
            location[1] += z(n.offsetTop);
            location[1] -= n.scrollTop;
            n = n.offsetParent;
			}

			return {
				x:location[0] + z(document.body.scrollLeft),
				y:location[1] + z(document.body.scrollTop)
			};
    },


    containsPoint:function(element,p) {
	    pos = this.abs(element);

			pos.height = element.clientHeight;
			pos.width = element.clientWidth;

			if( p.x >= pos.x && p.x <= (pos.x + pos.width)) {
				if(p.y >= pos.y && p.y <= pos.y + (pos.height / 2))
		    	return 1;
				else if(p.y >= pos.y + (pos.height / 2) && p.y <= pos.y + pos.height )
		    	return -1;
			}
	    return 0;
    },

	  docsize:function(){
      var docWidth = document.body.offsetWidth?document.body.offsetWidth:window.innerWidth;
      var docHeight = document.body.offsetHeight?document.body.offsetHeight:window.innerHeight;

      return {width:docWidth, height:docHeight};
	  },

	  windowsize: function () {
	  	return { width: window.innerWidth, height: window.innerHeight };
	  }
	};



	/*
		Drag and Drop implementation
	*/

	var DragAndDrop =  {

		draggable:null,
		dummy:null,
		started:false,

		/* contains position of the original click */
	  offset:null,

		//array of DOM elements that track drop event
	  trackers:null,

	  startDrag:function(elementnode, event){

	    this.ondragfired = false;
			this.disableSelection(document.body, event);
			//get original position of the trigger node
			//p = JSPositioning.absPosition(elementnode);
			var p = Positioning.mouse(event);

			this.offset = {x:p.x,y:p.y};

			document.body.onmousemove = function(event) {DragAndDrop.drag(event);	};
			document.body.onmouseup   = function(event) {DragAndDrop.stopdrag(event);	};

			// event.preventDefault();
	        this.onpickup(p);
		},

		stopdrag:function(e) {


			document.body.onmousemove = function(){};
			document.body.onmouseup = function(){};


			this.enableSelection(document.body);
			this.ondragfired = false;
			this.onstop();
		},

		drag:function(e) {
			var mousePos = Positioning.mouse(e);
			this.ondrag(mousePos,DragAndDrop.offset);
			if(this.ondragfired === false) {
				this.onbegin();
			}
			this.ondragfired = true;
			document.body.style.cursor='default';
		},

		onpickup:function(){},
		onbegin:function(){},
	    ondrag:function(){},
	    ondrop:function(){},
	    onstop:function(){},

	    setOpacity:function(element,value){
			element.style.opacity = value/100;
			element.style.filter = 'alpha(opacity=' + value + ')';
			element.style.zindex = 100;
		},

		disableSelection: function(element) {
            element.onselectstart = function() {return false;};
            element.unselectable = "on";
            element.style.MozUserSelect = "none";

		},

		enableSelection: function(element){
            element.onselectstart = null;
            element.unselectable = "off";
            element.style.MozUserSelect = "all";

		}
	};

	/**
	 * Global KeyListener
	 *
	 */
	var KeyListener = Class(function KeyListener(){

		event(this).attach({
			onEsc		:	event.multicast,
			onEnter	: event.multicast,
			onRight : event.multicast,
			onLeft  : event.multicast,
			onUp		: event.multicast,
			onDown 	: event.multicast
		});

		Event.attach(window, 'onkeydown').subscribe(
		function(args){
			switch(args.keyCode){
				case 27: this.onEsc(); 		break;
				case 13: this.onEnter(); 	break;
				case 37: this.onLeft(); 	break;
				case 38: this.onUp();			break;
				case 39: this.onRight(); 	break;
				case 40: this.onDown();		break;
			}
		}, this);

	});


	//module exports
	scope.exports(
		UIControl, UIElement, KeyListener,
		DataItem,ArrayDataItem,ObservableDataItem,
		//singletons
		{Positioning : Positioning},
		{DragAndDrop : DragAndDrop}
	);
}
});

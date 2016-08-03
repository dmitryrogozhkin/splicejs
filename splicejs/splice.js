/*
SpliceJS

The MIT License (MIT)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
try {
	!require;
} catch(ex){
	window.require = function(m){
		if(m == 'splice.window.js') return window;
		if(m == 'splice.document.js') return document;
	}
}

(function(window, document){

"use strict";
//logging setup
var log = !window.console ? {} : window.console;
//console log interface
if(!log.error) 	log.error = function(){};
if(!log.debug) 	log.debug = function(){};
if(!log.info) 	log.info  = function(){};
if(!log.warn) 	log.warn = function(){};
if(!log.warn) 	log.log = function(){};

//path delimiter
var _platform_ = window.__sjs_platform__;
if(!_platform_) _platform_ = 'WEB';

var _pd_ = '/'; //WEB
if(_platform_ == 'UNX') _pd_ = '/';
else if(_platform_ == 'WIN') _pd_ = '\\';

//_not_pd_ is used for in-string replacement must be properly escaped
var _not_pd_ = _pd_ == '/'?'\\\\':'/';

var config = {platform: _platform_};

function loadConfiguration(onLoad){
	var main = null;
	var head = document.head || document.getElementsByTagName('head')[0];
	// cycle through all script elements in document's head
	for(var i=0; i < head.childNodes.length; i++){
		var node = head.childNodes[i];
		if(!node.getAttribute) continue;
		if(node.getAttribute('sjs-main') != null) {
			main = node; break;
		}
	}

	// splice js script must have sjs-main attribute
	if(main == null) {
		log.warn('Application entry point is not defined.');
		return;
		//throw "SpliceJS script element must have 'sjs-main' attribute";
	}

	mixin(config, {
		appBase: 	context(window.location.href).path,
		sjsHome:	context(main.getAttribute('src')).path,
		sjsMain:	main.getAttribute('sjs-main'),
		splash:		main.getAttribute('sjs-splash'),
		version:	main.getAttribute('sjs-version'),
		mode:		main.getAttribute('sjs-start-mode'),
		debug:    	main.getAttribute('sjs-debug') == 'true' ? true:false
	});

	var sjsConfig = node.getAttribute('sjs-config');
	//load external configuration if available
	if(sjsConfig == null || !sjsConfig) {
		//mixin(configuration, config);
		onLoad(config);
	} else {
			//async load here
	}
}

function mixin(_t, _s){
	if(!_s) return _t;
	var keys = Object.keys(_s);
	if(	_s == window || _s == document ||
			_t == window || _t == document
			){
		log.error("Invalid object access " + _s.toString());
		return _t;
	}
	for(var key in keys){
		var p = _s[keys[key]];
		_t[keys[key]] = p;
	}
	return _t;
};

if(!Function.prototype.bind) {
	if(!Function.prototype.apply) return;
	Function.prototype.bind = function(t){
		var foo = this;
		return function(){ foo.apply(t,arguments); };
	};
}

/*
 * No support for Object.create
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create
 * */
if (typeof Object.create != 'function') {
	Object.create = (function() {
	var Object = function() {};
	return function (prototype) {
		if (arguments.length > 1) {
		throw Error('Second argument not supported');
		}
		if (typeof prototype != 'object') {
		throw TypeError('Argument must be an object');
		}
		Object.prototype = prototype;
		var result = new Object();
		Object.prototype = null;
		return result;
	};
	})();
}

/* IE Object.keys fill*/
if(typeof Object.keys !== 'function' ){
	Object.keys = function(obj){
		if(!obj) return null;
		var _keys = [];
		for(var key in  obj){
			if(obj.hasOwnProperty(key)) _keys.push(key);
		}
		return _keys;
	};
}

function _parseVersion(version, isWild){
	if(!version) return null;
	var v = {target:'*'}, a = version.split(':');

	if(a.length == 2) v.target = _trim(a[0]);
	a = a[a.length-1].split('-');

	v.min = _trim(!a[0]?(isWild?'*':undefined):a[0]);
	v.max = _trim(!a[1]?(isWild?'*':undefined):a[1]);
	return v;
}

var PATH_VARIABLES = {};
function setPathVar(key, value){
	//do not allow setting sjs home variable
	if(key === 'sjshome') return;

	if(!key || !value){
		return mixin({},PATH_VARIABLES);
	}
	PATH_VARIABLES[key] = value;
	return mixin({},PATH_VARIABLES);
}

function _split(s,regEx,skip){
	var parts = []
	, match = null;
	while(match = regEx.exec(s)){
		var before = s.substring(0,match.index);
		var item = match[0];
		s = s.substring(match.index + item.length);
		parts.push(before);
		if(!skip)	parts.push(item);
	}
	parts.push(s);
	return parts;
}

// returns URL context which allow further resolutions
// / - page context
function spv(url){
	var parts = _split(url,/{[^}{]+}/);
	var r = "";
	for(var i=0; i < parts.length; i++){
		var pv = PATH_VARIABLES[parts[i]];
		var s = parts[i];
		if(pv != null) s = spv(pv);

		if(r[r.length-1] == _pd_ && s[0] == _pd_ )
			r = r.substring(0,r.length-1) + s;
		else
			r = r + s;
	}
	return r;
}

function collapseUrl(path){
	var stack = [];
	var parts = path.split(_pd_);
	for(var i=0; i<parts.length; i++){
		if(!parts[i] && parts[i] == '') continue;
		if(parts[i] === '..' && stack.length >  0) {
			stack.pop();
			continue;
		}
		stack.push(parts[i]);
	}

	var cpath = '';
	var separator = '';
	if(path[0] == _pd_) cpath = _pd_;
	for(var i=0; i<stack.length; i++){
		cpath = cpath + separator + stack[i];
		if(stack[i] == 'http:') { separator = '//';  continue; }
		if(stack[i] == 'file:') { separator = '///'; continue; }
		separator = _pd_;
	}
	return cpath;
}

function isAbsUrl(url){
	if(!url) return false;
	//platform specific URL
	if(config.platform == 'UNX'){
		if(url.startsWith('/')) return true;
		return false;
	}
	if(config.platform == 'WIN'){
		if(/^[a-zA-Z]:\\/.test(url)) return true;
		return false;
	}
	if(config.platform == 'WEB'){
		if(/^[a-zA-Z]+:\/\//.test(url)) return true;
		return false;
	}
}

function context(contextUrl){
	//context must end with /
	var ctx = null;

if(contextUrl) {
	ctx = contextUrl.replace(new RegExp(_not_pd_,"g"),_pd_);
	ctx = ctx.substring(0,ctx.lastIndexOf(_pd_)+1);
}

if(!ctx && config.appBase) ctx = config.appBase;

	if(ctx != null && ctx && ctx[ctx.length-1] != _pd_)
		throw 'Context URL must end with "'+ _pd_ +'"';

	return {
	isAbs: isAbsUrl(ctx),
	path:ctx,
		source:contextUrl,
		resolve:function(url){
			if(!url) return null;

			url = url.replace(new RegExp(_not_pd_,"g"),_pd_);
			//resolve path variables
			url = spv(url);
			//not page context
			if(isAbsUrl(url)) return collapseUrl(url) ;
			return collapseUrl(ctx + url);
		}
	}
}

function fileExt(f){
	return f.substring(f.lastIndexOf('.'));
}

function peek(a){
	if(!a) return null;
	if(a.length > 0) return a[a.length - 1];
	return null;
}

//some browsers to not support trim function on strings
function _trim(s){if(!s) return s;
	if(String.prototype.trim) return s.trim();
	return s.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
}

function fname(foo){
	/*
	-- support regular expression only
	because MS Edge browser does not support the name property
	if(foo.name != null) {
		if(foo.name) return foo.name;
		return 'anonymous';
	}
	*/
if(typeof foo != 'function') throw 'Unable to obtain function name, argument is not a function'
var match = /function(\s*[A-Za-z0-9_\$]*)\(/.exec(foo.toString());
if(!match)  return 'anonymous';
	var name = _trim(match[1]);
	if(!name) return 'anonymous';
	return name;
}


function _namespaceAdd(path,obj,isSealed){
	if(!path) return this;
	if(this.__sjs_seal__[path]) throw 'Namespace ' +path +' is sealed';
	var parts = path.split('.');
	var target = this;
	for(var i=0; i<parts.length-1; i++){
		if(target[parts[i]] == null) target[parts[i]] = Object.create(null);
		target = target[parts[i]];
	}
	if(target[parts[parts.length-1]] != null) throw "Namespace conflict: " + path;
	target[parts[parts.length-1]] = obj;

	if(isSealed == true) this.__sjs_seal__[path] = true;
}


function Namespace(){
	if(!(this instanceof Namespace) ) return new Namespace();
	this.sequence = 0;
	this.__sjs_seal__ = {};
	this.children = null;
}

Namespace.prototype = {
		add : function(path, obj, isSealed){
			if(typeof(path)=='object' || typeof(path) == 'function'){
				for(var i=0; i < arguments.length; i++){
					var arg = arguments[i];

					if(typeof arg === 'function' ){
						_namespaceAdd.call(this, fname(arg),arg,isSealed);
						continue;
					}

					if(typeof arg == 'object') {
						var keys = Object.keys(arg);
						for(var key in keys){
							_namespaceAdd.call(this, keys[key],arg[keys[key]],isSealed);
						}
						continue;
					}
				}
				return this;
			}

			if(typeof(path) == 'string'){
				_namespaceAdd.call(this, path,obj,isSealed);
			}
			return this;
		},
		lookup:function(path){
			if(!path) return null;
			var parts = path.split('.');
			var target = this;
			for(var i=0; i<parts.length-1; i++){
				if(target[parts[i]] == null) target[parts[i]] = Object.create(null);
				target = target[parts[i]];
				if(target == null) break;
			}
			return target[parts[parts.length-1]];
		}
};

var _fileHandlers = {
	'.js': {
		importSpec:function(filename){
			return new ImportSpec(filename);
		},
		load: function(filename,loader){
			//document script loader
			var head = document.head || document.getElementsByTagName('head')[0];
			var script = document.createElement('script');
			script.setAttribute("type", "text/javascript");
			script.setAttribute("async","");
			script.setAttribute("src", filename);

			script.onload = script.onreadystatechange = function(){
				if(!script.readyState || script.readyState == 'complete' || script.readyState == 'loaded') {
					loader.onitemloaded(filename);
				}
			};
			head.appendChild(script);
		}
	}
};


/*
	Loads resources on existing stack
*/
function load(resources,oncomplete){
	/* get base context */
	var ctx = context();
	/* check is resources are abs urls, if not resolve to abs url*/
	for(var i=0; i<resources.length; i++){
		if(!isAbsUrl(resources[i]))
			resources[i] = ctx.resolve(resources[i]);
	}
	new AsyncLoader(resources,oncomplete).load();
}

/*
	loader function
*/
function applyImports(imports){
	var scope = this;
	if(!scope.imports) scope.add('imports',new Namespace());
	for(var i=0; i<imports.length; i++){
		if(!imports[i].namespace) continue;
		var ns = imports[i].namespace;
		var x = IMPORTS_MAP[imports[i].url];
		if(!x || !x.scope) continue;
		x = x.scope.__sjs_module_exports__;
		var keys = Object.keys(x);
		for(var key in keys){
			scope.add('imports.'+ns+'.'+keys[key],x[keys[key]]);
		}
	}
}

function _exports(scope){
	scope.__sjs_module_exports__ = Object.create(null);
	return function(){
		var exports = scope.__sjs_module_exports__;
		//if(!exports) exports = scope.__sjs_module_exports__ = Object.create(null);
		for(var i=0; i < arguments.length; i++){
			var arg = arguments[i];
			if(typeof arg === 'function' ){
				exports[fname(arg)] = arg;
				continue;
			}
			if(typeof arg === 'object'){
				var keys = Object.keys(arg);
				for(var k=0; k < keys.length; k++){
					exports[keys[k]] = arg[keys[k]];
				}
				continue;
			}
		}
	}
}

function _acopy(s,t){
	if(!s) return;
	if(!(s instanceof Array)) return;
	var keys = Object.keys(s);
	for(var key in keys){
		t[keys[key]] = s[keys[key]];
	}
}

function _vercomp(v1,v2){
	if(v1 == '*' || v2 == '*') return 0;
	if(!v1 || !v2) return undefined;

	v1 = _split(v1,/\./,true);
	v2 = _split(v2,/\./,true);
	//padd and compare version numbers
	for(var i=0; i<3; i++){
		//padd
		if(v1[i] == null) v1[i] = 0;
		if(v2[i] == null) v2[i] = 0;
		// compare
		var r = (+v1[i]-(+v2[i]));
		if(r == 0) continue;
		return r/Math.abs(r);
	}
	return 0;
}



function qualifyImport(url){
	var parts = url.split('|');
	//nothing to qualify its just a URL
	if(parts.length == 1) return url;
	
	//unable to qualify url since config version is not present
	if(!config.version) return null;
	
	//version qualifier
	var regex = /([a-z]+:)*(([0-9]*\.[0-9]*\.[0-9]*)|\*)*-*(([0-9]*\.[0-9]*\.[0-9]*)|\*)*/;

	//parse config version
	var rc = regex.exec(config.version);
	//no mercy for invalid syntax
	if(!rc) throw 'Invalid version configuration parameter: ' + config.version;

	//only version quallifier is supported
	//qualify version at parts[0]
	var r = regex.exec(_trim(parts[0]));
	
	//no mercy for invalid syntax	
	if(r == null) throw 'Invalid version qualifier: ' + url; 

	//target platform
	var v = {target : r[1],	min : r[2], max : r[4] || r[2]=='*'?'*':r[4]}; 
	var vc = {target : rc[1], min : rc[2], max : rc[4]};

	//targets dont match
	if((v.target || null) != (vc.target || null)) return null;

	var pass = (_vercomp(v.min, vc.min) <= 0 &&  _vercomp(v.max, vc.min) >= 0);
	if(pass) 	return _trim(parts[parts.length -1]);
	return null;
}

function _dependencies(items, ctx){
	if(!items || items.length <= 0) return null;
	var r = {resources:[], imports:[]},
	appCtx = context(config.appBase);

	for(var i=0; i < items.length; i++){
		var item = items[i], url = '', ns = '';

		//name space includes
		if(typeof(item)  == 'object'){
			for(var key in item){
				if(item.hasOwnProperty(key)) {
					url = item[key];
					ns = key;
					break;
				}
			}
		}  //no namespace includes
		else {
			url = item;
		}

		//check if import qualifes based on the url modifiers |
		if(!(url = qualifyImport(url))) continue;

		//this means that our url is relative to application context
		//i.e. absolute to application's base url
		if(url[0] == '/') {
			url = appCtx.resolve(url.substr(1));
		}
		else {
			url = ctx.resolve(url);
		}

		r.resources.push(url);
		r.imports.push({namespace:ns, url:url});
	}
	return r.imports;
}


function _required(m,ctx){
	var r = {resources:[], imports:[]};
    if(!m || (!m.required && !m.version)) return r;

	var items = [];
	//all required
	if(m.required instanceof Array) items = m.required;


    var appCtx = context(config.appBase);

	//versioned required
	if(typeof m.version == 'object' && config.version){
		var v = _parseVersion(config.version);
      	//extract versions
		var keys = Object.keys(m.version);
      	var versions = [];
		for(var key in keys){
        	versions.push({version:_parseVersion(keys[key], true), required:m.version[keys[key]]});
		}

		//evaluate versions
		for(var i=0; i<versions.length; i++){
      		var ver = versions[i].version;

			//compare target
			if(ver.target) {
        		if(v.target != ver.target ) continue;
      		}
      		//compare versions
      		var pass = (_vercomp(ver.min, v.min) <= 0 &&  _vercomp(ver.max, v.min) >= 0);
			if(pass == true) _acopy(versions[i].required, items);
		}
	}

	for(var i=0; i < items.length; i++){
		var item = items[i], url = '', ns = '';

		//name space includes
		if(typeof(item)  == 'object'){
			for(var key in item){
				if(item.hasOwnProperty(key)) {
					url = item[key];
					ns = key;
					break;
				}
			}
		}  //no namespace includes
		else {
			url = item;
		}
		//this means that our url is relative to application context
		//i.e. absolute to application's base url
		if(url[0] == '/') {
			url = appCtx.resolve(url.substr(1));
		}
		else {
			url = ctx.resolve(url);
		}

		r.resources.push(url);
		r.imports.push({namespace:ns, url:url});
	}
	return r;
}

var IMPORTS_MAP = new Object(null);

function ImportSpec(fileName){
	this.imports = null;
	this.prerequisites = null;
	this.fileName = fileName;
}
ImportSpec.prototype = { 
	execute : function(){
		this.isProcessed = true;
	}
}


var _loaderStats = {
	pendingImports:0,	loadingIndicator:null,
	oncomplete:[], loaders:[],
	moduleSpec:null
};


function to(array,fn){
	if(typeof fn != 'function') return [];
	var result = []
	,	keys = Object.keys(array);
	for(var key in keys ){
		result.push(fn(array[keys[key]]));
	}
	return result;
}

/*
	Asynchronous loader
*/
function AsyncLoader(resources, oncomplete){
	this.resources = resources;
	this.oncomplete = oncomplete;

	if(typeof oncomplete == 'function') {
		_loaderStats.oncomplete.push(oncomplete);
	}
}

AsyncLoader.prototype = {
	load : function(){
		for(var i=0; i<this.resources.length; i++){
			var filename = this.resources[i];
			var mapped = IMPORTS_MAP[filename];
			if(mapped) continue;


			var handler = _fileHandlers[fileExt(filename)];
			if(!handler) {
				//default import spec
				var spec = new ImportSpec(filename);
				IMPORTS_MAP[filename] = spec;
				spec.status = "loading";
				continue;
			}
			_loaderStats.pendingImports++;

			IMPORTS_MAP[filename] = handler.importSpec(filename);
			handler.load(filename, this, IMPORTS_MAP[filename]);
		}
	},

	onitemloaded : function(item){
		var spec = IMPORTS_MAP[item] = (_loaderStats.moduleSpec || IMPORTS_MAP[item]);
			 
		if(!spec) {
			log.error("wtf no spec");
		}

		if(_loaderStats.loadingIndicator) {
			_loaderStats.loadingIndicator.update(0,1,item);
		}
		
		//get current module context
		var ctx = context(item);
		
		//process ModuleSpec
		if(spec instanceof ModuleSpec){
			
			//set scope URI
			spec.scope.__sjs_uri__ = item; 
			

			//resolve prerequisites
			var prereqs = spec.prerequisites = _dependencies(spec.__sjs_module__.prerequisite,ctx);
			

			//	resolve required resources relative to
			//	current context
			var	imports = spec.imports = spec.scope.__sjs_module_imports__ = _dependencies(spec.__sjs_module__.required,ctx);
			

			//Load dependencies
			if(isPendingPrerequisites(prereqs)) {
				load(to(prereqs,function(i){return i.url}));
			} else if(imports) {
				load(to(imports,function(i){return i.url}));
			}
		}

		//clear current module spec, resource loaded next maybe not be a module
		_loaderStats.moduleSpec = null;

		/*
		//execute import if no import dependencies are present
		if(!spec.imports || spec.imports.length == 0) {
			spec.execute();
		}
		*/
		if(--_loaderStats.pendingImports == 0){
			_loadingComplete();
		}
	}
}

function _loadingComplete(){
	log.debug("Loading is complete");

	/* module loading is complete execute dependency tree*/
	log.debug("Run dependency tree");
	
	executeImportsTree();
		
	var oncomplete = _loaderStats.oncomplete.pop();
	while(oncomplete){
		if(typeof(oncomplete) == 'function') oncomplete();
		oncomplete = _loaderStats.oncomplete.pop();
	}

	// incase only prerequisites were processed check for other panding modules
	continueLoading();
}

var dfsStack = [];
function isDfsCycle(spec){
	var isCycle = false;
	for(var i=(dfsStack.length -2); i>=0; i--){
		if(spec === dfsStack[i]) {
			isCycle = true;
			break;
		}
	}
	if(!isCycle) return false;
	//print cycle and throw exception
	if(isCycle === true) {
		for(var i=(dfsStack.length -1); i>=0; i--){
			log.error(dfsStack[i].fileName);
		}
		throw 'Cyclical dependency';
	}
	return false;
}

/**
 * @param {ImportSpec} importSpec 
*/
function executeImportSpec(importSpec){
	if(importSpec.isProcessed  === true) return;
		
	if(isDfsCycle(importSpec)) {  
		log.debug("Cycle detected");
		return;
	}

	if( (!importSpec.prerequisites || importSpec.prerequisites.length ==0 ) &&
		(!importSpec.imports || importSpec.imports.length == 0)) {
		importSpec.execute();
		return;
	}

	//run prerequisites first
	if(importSpec.prerequisites)
	for(var i=0; i< importSpec.prerequisites.length; i++){
		var preq = importSpec.prerequisites[i];
		dfsStack.push(IMPORTS_MAP[preq.url]);
		executeImportSpec(IMPORTS_MAP[preq.url]);
		dfsStack.pop();
	}		

	//run import modules
	for(var i = 0; i < importSpec.imports.length; i++ ){
		var depSpec = IMPORTS_MAP[importSpec.imports[i].url];
		//import had not been loaded yet, exit
		if(!depSpec) return;
		dfsStack.push(depSpec);
		executeImportSpec(depSpec);
		dfsStack.pop();
	}
	importSpec.execute();
}

/** 
 * 
 */
function executeImportsTree(){
	var result = [];
	var keys = Object.keys(IMPORTS_MAP);
	for(var key in keys ){
		var proc = IMPORTS_MAP[keys[key]];
		executeImportSpec(proc);
	}
	return result;
}


/**  
 * Return a list of imports that are yet to be loaded
 */
function _pendingImports(spec){
	if(spec.isProcessed) return null;
	if(!spec.imports || spec.imports.length == 0) return null;

	var result = [];
	for(var i=0; i<spec.imports.length; i++){
		var s = IMPORTS_MAP[spec.imports[i].url];
		if(!s) result.push(spec.imports[i]);
	}

	if(result.length == 0 ) return null;
	return result;
}

function forMap(m,fn){
	if(typeof(fn) != 'function') return;
	var keys = Object.keys(m);
	for(var key in keys ){
		fn(IMPORTS_MAP[keys[key]]);
	}
}

function continueLoading(){
	forMap(IMPORTS_MAP, function(spec){
		var imports = _pendingImports(spec);
		if(!imports) return;
		setTimeout(function(){
			load(to(imports,function(i){return i.url}));
		},1);
	});
}

function isPendingPrerequisites(prereq){
	if(!prereq || prereq.length == 0) return false;
	for(var i=0; i < prereq.length; i++){
		var s = IMPORTS_MAP[prereq[i].url];
		if(!s) return true;
	}
	return false;
}

/*
	Module processor
*/
function ModuleSpec(scope,m){
	this.scope = scope;
	this.__sjs_module__ = m;
}
ModuleSpec.prototype.execute = function(){
	this.isProcessed = true;
	
	if(this.prerequisites)
		applyImports.call(this.scope,this.prerequisites);
	
	if(this.imports)
		applyImports.call(this.scope,this.imports);
	this.__sjs_module__.definition.bind(this.scope)(this.scope);
}

/*
	Loads a module
	m - module descriptor
*/
function _module(m){

	if(typeof m === 'string') {
		return IMPORTS_MAP[m];
	}

	/*init module scope*/
	var scope = new Namespace(null);

	scope.add('sjs',mixin(Object.create(null),_core),true);
	scope.add('exports',_exports(scope));
	
	//module scope calls only
	scope.sjs.setLoadingIndicator = function(splash){
		_loaderStats.loadingIndicator = splash;
		return splash;
	};

	// create module spec
	_loaderStats.moduleSpec = new ModuleSpec(scope,m);

}

_module.list= function list(){
	return mixin({},IMPORTS_MAP);
}

_module.listProcessed = function listProcessed(){
	var result = [];
	var keys = Object.keys(IMPORTS_MAP);
	for(var key in keys ){
		if(IMPORTS_MAP[keys[key]].isProcessed) result.push(IMPORTS_MAP[keys[key]]);
	}
	return result;
}

_module.listPending = function listPending(){
	var result = [];
	var keys = Object.keys(IMPORTS_MAP);
	for(var key in keys ){
		var spec = IMPORTS_MAP[keys[key]];
		if(!spec.isProcessed && typeof(spec.execute) == "function" )
		result.push(IMPORTS_MAP[keys[key]]);
	}
	return result;
}

function addTo(s,t){
	var keys = Object.keys(s);
	for(var key in keys) {
		if(t[keys[key]]) continue;
		t[keys[key]] = s[keys[key]];
	}
}

var extension = mixin(Object.create(null), {
	loader: function(obj){
		addTo(obj,_fileHandlers);
	}
});

function loadMain(config){
	if(config.sjsMain != null && config.sjsMain){
		log.info('Loading main module: ' + config.sjsMain);
		load([config.sjsMain]);
	}
}

function start(config){
	//load main modules
	if(config.splash != null && config.splash){
		load([config.splash], function(){
			loadMain(config);
		});
	}
	else loadMain(config);
}

var _core = mixin(Object.create(null),{
	config      : function() {return mixin({},config)},
  	namespace   : Namespace,
	pathVar 	: setPathVar,
	context  	: context,
	mixin		: mixin,
	'module'    : _module,
	fname		: fname,
	load		: load,
	extension   : extension,
 	log 		: log,
	document	: document,
	ImportSpec	: ImportSpec,
	filext		:fileExt
});

var _debug = mixin(Object.create(null),{
    spv :spv,
    split:_split,
    collapseUrl: collapseUrl,
    isAbsUrl:isAbsUrl,
    fileExt:fileExt,
    peek: peek,
    trim: _trim,
    _parseVersion:_parseVersion

});


window.sjs = _core;
window.global  = {sjs: window.sjs };
try {
    global.sjs = _core;
}catch(ex){
}


loadConfiguration(function(config){
    PATH_VARIABLES['{sjshome}'] = config.sjsHome;
    new window.Image().src = context().resolve('resources/images/bootloading.gif');

    if(config.debug == true){
       _core.debug = _debug;
    }

    if(config.mode == 'onload'){
        window.onload = function(){ start(config);}
    }
    else if(config.mode == 'node'){
        start(config);
    }
    else {
        _core.start = function(){start(config);}
    }
});

})( (require('splice.window.js')), (require('splice.document.js')));

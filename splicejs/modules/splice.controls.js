_.Module({
	
required:['modules/splice.controls/splice.controls.css',
          'modules/splice.controls/splice.controls.htmlt'],	
	
definition:function(){
	
	
	var Button = _.Namespace('SpliceJS.Controls').Class(function Button(args){
		_.info.log('Creating Button');
		
		if(this.content && this.content['label']){
			this.elements.buttonContainer.value = args.content['label']; 
		} else {
			this.elements.buttonContainer.value = 'button';
		}
		
		var self = this;
		this.elements.buttonContainer.onclick = function(){
			if(self.isDisabled == true) return;
			self.onClick();
		};
		
		if(this.isDisabled) this.disable();
		if(this.isHidden) 	this.hide();
		
	});

	
	Button.prototype.setLabel = function(label){
		this.elements.buttonContainer.value = label;
	}
	
	Button.prototype.onClick = function(){
		_.debug.log('Event is not assigned');
	};
	
	
	Button.prototype.changeState = function(args){
		_.debug.log('Chaning button\'s state');
		if(args && args.isHidden)
			this.hide();
		else 
			this.show();
	};
	
	
	Button.prototype.hide = function(){
		var self = this;
		if(this.animate){
			_.Animate(this.elements.buttonContainer).opacity(100, 0, 300,function(){
				self.elements.buttonContainer.style.display = 'none';
			});
		}
		else {
			this.elements.buttonContainer.style.display = 'none';
		}
	}
	
	Button.prototype.show = function(){
		if(this.animate) {
			this.elements.buttonContainer.style.opacity = 0;
		}
		this.elements.buttonContainer.style.display = 'block';
		
		if(this.animate) {
			_.Animate(this.elements.buttonContainer).opacity(0, 100, 300);
		}
	}
	
	Button.prototype.enable = function(){
		this.elements.buttonContainer.className = '-splicejs-button';
		this.isDisabled = false;
	};
	
	Button.prototype.disable = function(){
		this.elements.buttonContainer.className = '-splicejs-button-disabled';
		this.isDisabled = true;
	}
	
	
	
	var TextField = _.Namespace('SpliceJS.Controls').Class(function TextField(){
		var self = this;
		this.elements.textFieldContainer.onchange = function(){
			self.dataItem[self.dataPath] = this.value;
			
			self.dataOut(self.dataItem);
		}
	});
	TextField.prototype.dataOut = function(){
		throw 'Data out interface is not assigned';
	}
		
	TextField.prototype.dataIn = function(dataItem){
		this.dataItem = dataItem;
		_.debug.log('TextField on Data item ' + dataItem);
	};
	
	
	
	var CheckBox = _.Namespace('SpliceJS.Controls').Class(function CheckBox(args){
		
		var self = this;
		
		if(this.isHidden) this.elements.checkBoxContainer.style.display = 'none';
		
		this.concrete.dom.onclick = function(){
			_.debug.log('I am check box');
			var isChecked = self.concrete.dom.checked; 
			if(self.dataItem) {
				self.dataItem[self.dataPath] = isChecked;
			}
			
			if(self.dataOut) 	self.dataOut(self.dataItem);
			if(self.onCheck)	self.onCheck(isChecked);
		};
	
	});

	
	CheckBox.prototype.dataIn = function(dataItem){
		this.dataItem = dataItem;
	};
	
	
	
	
	
	
	
	var DataTable = _.Namespace('SpliceJS.Controls').Class(function DataTable(args){
		/* call parent constructor */
		SpliceJS.Controls.UIControl.call(this,args);
		
		_.info.log('Constructing date table');
		this.dom = this.elements.dataTableContainer;
	
		this.dataRows = [];
		this.haderRow = null;
		
	}).extend(SpliceJS.Controls.UIControl);
	
	

	/*
	 * Updating data model
	 * - keep count of existing rows
	 * - keep references to individual rows
	 * - iterate over existing rows to update row's calling dataIn on the row object
	 * - if new rows create new rows in the table 
	 * 
	 * */
	DataTable.prototype.dataIn = function(dataInput){
		
		var data 	= dataInput.data;
		var headers = dataInput.headers;
		
		/* add columns */
		if(headers instanceof Array) {
			
			if(this.headerRow) this.headerRow.dataIn(headers);
			else {
				/* custom header row content */
				if(this.headerTemplate){
					this.headerRow = new this.headerTemplate({parent:this});
					this.headerRow.dataIn(headers);
					
					this.addDomHeader(this.headerRow.concrete.dom);
				}
				/* standard table header row */
				else {
					this.addHeaderRow(headers);
				}
			}
		}
		
		
		/* data must be an array of objects */
		if(!(data instanceof Array)) return;
		
		
		/* udpate existing rows */
		for(var j=0; j < this.dataRows.length; j++){
			if(!data[j]){
				/* remove extra dataRows and table rows*/
				
				for(var k=this.dataRows.length-1; k>=j; k--){
					
					this.removeRowByIndex(k+1); //!!!!! this is because of the header row
					this.dataRows.splice(k,1);
				}
				
				break;
			}
			this.dataRows[j].dataIn(data[j]);
		}

				
		/* add new rows*/
		for(var i=j; i<data.length; i++){
			var r = data[i];
			
			/* insert templated row */
			if(this.itemTemplate) {
				var dataRow = new this.itemTemplate({parent:this});
				
				this.dataRows.push(dataRow);
				
				dataRow.dataIn(r);
				if(! (dataRow.concrete instanceof SpliceJS.Modular.Concrete)) throw 'DataTable: rowTemplate type is invalid must be concrete';
				this.addDomRow(dataRow.concrete.dom);
				continue;
			}
			this.addRow(r);
		}
		
	};
	
	
	DataTable.prototype.removeRowByIndex = function(rowIndex){
		this.dom.deleteRow(rowIndex);
	};
	
	DataTable.prototype.clear = function(){
		
	};
	

	
	DataTable.prototype.addRowTo = function(destination, row){
		
		var newrow =  destination.insertRow();
		
		for(var i=0; i < row.length; i++ ){
			
			var cell = newrow.insertCell();
			
			if(typeof(row[i]) == 'object')
				cell.appendChild(row[i]);
			else {
				cell.appendChild(document.createTextNode(row[i]));
			}
		}
	};

	DataTable.prototype.addHeaderRow = function(headers){
		
		if(!headers) return;
		if(this.dom.tHead) this.dom.deleteTHead();
		
		var tHead = this.dom.createTHead();
		
		this.addRowTo(tHead, headers);
	};
	
	
	
	
	DataTable.prototype.addBodyRow = function(row){
		
		if(!row) return;
		if(!(row instanceof Array)) throw 'Argument must be of type Array';
		
		var tBody = this.dom.tBodies[0]; 
		if(!tBody) tBody = this.dom.createTBody();
		
		this.addRowTo(tBody,row);
	};

	DataTable.prototype.addDomRow = function(dom){
		var row = [];	
		for(var i=0; i< dom.childNodes.length; i++){
			var node = dom.childNodes[i];
			/* element nodes only */
			if(node.nodeType === 1) row.push(node);
		}
		this.addBodyRow(row);
	};

	DataTable.prototype.addDomHeader = function(dom){
		var row = [];	
		for(var i=0; i< dom.childNodes.length; i++){
			var node = dom.childNodes[i];
			/* element nodes only */
			if(node.nodeType === 1) row.push(node);
		}
		this.addHeaderRow(row);
	};

	
	var DataTableRow =  _.Namespace('SpliceJS.Controls').Class(function DataTableRow(args){
		
		/* 
		 * process content placeholders before they are 
		 * pulled by parent control
		 * */
		var textNodes = _.Doc.selectTextNodes(this.concrete.dom);
		this.contentMap = [];
		
		for(var i=0; i<textNodes.length; i++){
			var value = textNodes[i].nodeValue;
			if(!value) continue;
			if(!value.startsWith('@')) continue;
		
			var key = value.substring(1,value.length);
			
			this.contentMap[key] = textNodes[i];
		}
		
		
		
	});
	
	DataTableRow.prototype.selectRow = function(){
		_.debug.log('select row');
	};
	
	DataTableRow.prototype.onDeleteClick = function(){
		this.onDelete(this.data);
	};
	
	DataTableRow.prototype.dataIn = function(data){
		
		var textNodes = _.Doc.selectTextNodes(this.concrete.dom);
		this.data = data;
		
		for(var key in this.contentMap){
			
			var node = this.contentMap[key];
			var value = data[key];
			node.nodeValue = value;
		}
		
		this.dataOut(this.data);
	
	};
	
	DataTableRow.prototype.dataOut = new _.Multicaster();

	
}	
});
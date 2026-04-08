/**
 * Copyright (c) 2020-2025, JGraph Holdings Ltd
 * Copyright (c) 2020-2025, draw.io AG
 */
/**
 * Sample plugin.
 */
Draw.loadPlugin(function(ui) {

	/**
	 * Overrides SVG export to add metadata for each cell.
	 */
	var graphCreateSvgImageExport = Graph.prototype.createSvgImageExport;

	Graph.prototype.createSvgImageExport = function()
	{
		var exp = graphCreateSvgImageExport.apply(this, arguments);
		var graph = this;

		// Adds metadata for root and layer cells
		var expAddCellData = exp.addCellData;

		exp.addCellData = function(cell, group, includeValue)
		{
			group = expAddCellData.apply(this, arguments);
			var model = graph.model;
			var isRoot = cell == model.getRoot();
			var isLayer = !isRoot && model.getParent(cell) == model.getRoot();

			if (isRoot || isLayer)
			{
				group.setAttribute('id', 'cell-' + cell.id);

				if (mxUtils.isNode(cell.value))
				{
					group.setAttribute('content', mxUtils.getXml(cell.value));

					for (var i = 0; i < cell.value.attributes.length; i++)
					{
						var attrib = cell.value.attributes[i];
						group.setAttribute('data-' + attrib.name, attrib.value);
					}
				}

				group.setAttribute('type', isRoot ? 'root' : 'layer');
			}

			return group;
		};

		// Overrides rendering to add metadata
		var expDrawCellState = exp.drawCellState;

		exp.drawCellState = function(state, canvas)
		{
			var svgDoc = canvas.root.ownerDocument;
			var g = (svgDoc.createElementNS != null) ?
					svgDoc.createElementNS(mxConstants.NS_SVG, 'g') : svgDoc.createElement('g');
			g.setAttribute('id', 'cell-' + state.cell.id);

			// Temporary replaces root for content rendering
			var prev = canvas.root;
			prev.appendChild(g);
			canvas.root = g;

			expDrawCellState.apply(this, arguments);

			// Adds metadata if group is not empty
			if (g.firstChild == null)
			{
				g.parentNode.removeChild(g);
			}
			else if (mxUtils.isNode(state.cell.value))
			{
				g.setAttribute('content', mxUtils.getXml(state.cell.value));

				for (var i = 0; i < state.cell.value.attributes.length; i++)
				{
					var attrib = state.cell.value.attributes[i];
					g.setAttribute('data-' + attrib.name, attrib.value);
				}

				// Adds type attribute
				g.setAttribute('type', graph.model.isEdge(state.cell) ? 'edge' : 'vertex');
			}

			// Restores previous root
			canvas.root = prev;
		};

		return exp;
	};

});

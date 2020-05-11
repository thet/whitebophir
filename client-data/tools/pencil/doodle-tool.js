let doodletool = doodletool || {};

doodletool.pencil = {

	//Indicates the id of the line the user is currently drawing or an empty string while the user is not drawing
	curLineId: "",
	lastTime: performance.now(), //The time at which the last point was drawn

	//The data of the message that will be sent for every new point
	PointMessage: function (x, y) {
		this.type = 'child';
		this.parent = this.curLineId;
		this.x = x;
		this.y = y;
	},

	startLine: function (x, y, evt) {

		//Prevent the press from being interpreted by the browser
		evt.preventDefault();

		this.curLineId = Tools.generateUID("l"); //"l" for line

		Tools.drawAndSend({
			'type': 'line',
			'id': this.curLineId,
			'color': Tools.getColor(),
			'size': Tools.getSize(),
			'opacity': Tools.getOpacity()
		});

		//Immediatly add a point to the line
		this.continueLine(x, y);
	},

	continueLine: function (x, y, evt) {
		/*Wait 70ms before adding any point to the currently drawing line.
		This allows the animation to be smother*/
		if (this.curLineId !== "" && performance.now() - this.lastTime > 70) {
			Tools.drawAndSend(new this.PointMessage(x, y));
			this.lastTime = performance.now();
		}
		if (evt) evt.preventDefault();
	},

	stopLine: function (x, y) {
		//Add a last point to the line
		this.continueLine(x, y);
		this.curLineId = "";
	},

	renderingLine: {},
	draw: function (data) {
		switch (data.type) {
			case "line":
				this.renderingLine = this.createLine(data);
				break;
			case "child":
				var line = (this.renderingLine.id === data.parent) ? this.renderingLine : this.svg.getElementById(data.parent);
				if (!line) {
					console.error("Pencil: Hmmm... I received a point of a line that has not been created (%s).", data.parent);
					line = this.renderingLine = this.createLine({ "id": data.parent }); //create a new line in order not to loose the points
				}
				this.addPoint(line, data.x, data.y);
				break;
			case "endline":
				//TODO?
				break;
			default:
				console.error("Pencil: Draw instruction with unknown type. ", data);
				break;
		}
	},

	dist: function (x1, y1, x2, y2) {
		//Returns the distance between (x1,y1) and (x2,y2)
		return Math.hypot(x2 - x1, y2 - y1);
	},

	pathDataCache: {},
	getPathData: function (line) {
		var pathData = this.pathDataCache[line.id];
		if (!pathData) {
			pathData = line.getPathData();
			this.pathDataCache[line.id] = pathData;
		}
		return pathData;
	},

	svg: Tools.svg,
    addPoint: function (line, x, y) {
		var pts = this.getPathData(line), //The points that are already in the line as a PathData
			nbr = pts.length; //The number of points already in the line
		switch (nbr) {
			case 0: //The first point in the line
				//If there is no point, we have to start the line with a moveTo statement
				npoint = { type: "M", values: [x, y] };
				break;
			case 1: //There is only one point.
				//Draw a curve that is segment between the old point and the new one
				npoint = {
					type: "C", values: [
						pts[0].values[0], pts[0].values[1],
						x, y,
						x, y,
					]
				};
				break;
			default: //There are at least two points in the line
				//We add the new point, and smoothen the line
				var ANGULARITY = 3; //The lower this number, the smoother the line
				var prev_values = pts[nbr - 1].values; // Previous point
				var ante_values = pts[nbr - 2].values; // Point before the previous one
				var prev_x = prev_values[prev_values.length - 2];
				var prev_y = prev_values[prev_values.length - 1];
				var ante_x = ante_values[ante_values.length - 2];
				var ante_y = ante_values[ante_values.length - 1];


				//We don't want to add the same point twice consecutively
				if ((prev_x == x && prev_y == y)
					|| (ante_x == x && ante_y == y)) return;

				var vectx = x - ante_x,
					vecty = y - ante_y;
				var norm = Math.hypot(vectx, vecty);
				var dist1 = this.dist(ante_x, ante_y, prev_x, prev_y) / norm,
					dist2 = this.dist(x, y, prev_x, prev_y) / norm;
				vectx /= ANGULARITY;
				vecty /= ANGULARITY;
				//Create 2 control points around the last point
				var cx1 = prev_x - dist1 * vectx,
					cy1 = prev_y - dist1 * vecty, //First control point
					cx2 = prev_x + dist2 * vectx,
					cy2 = prev_y + dist2 * vecty; //Second control point
				prev_values[2] = cx1;
				prev_values[3] = cy1;

				npoint = {
					type: "C", values: [
						cx2, cy2,
						x, y,
						x, y,
					]
				};
		}
		pts.push(npoint);
		line.setPathData(pts);
	},

	createLine: function (lineData) {
		//Creates a new line on the canvas, or update a line that already exists with new information
		var line = this.svg.getElementById(lineData.id) || Tools.createSVGElement("path");
		line.id = lineData.id;
		//If some data is not provided, choose default value. The line may be updated later
		line.setAttribute("stroke", lineData.color || "black");
		line.setAttribute("stroke-width", lineData.size || 10);
		line.setAttribute("opacity", Math.max(0.1, Math.min(1, lineData.opacity)) || 1);
		Tools.drawingArea.appendChild(line);
		return line;
	},

};


Tools.add({
    "name": "Pencil",
    "shortcut": "p",
    "listeners": {
        "press": doodletool.pencil.startLine,
        "move": doodletool.pencil.continueLine,
        "release": doodletool.pencil.stopLine,
    },
    "draw": doodletool.pencil.draw,
    "mouseCursor": "crosshair",
    //"mouseCursor": "url('tools/pencil/cursor.svg'), crosshair",
    "icon": "tools/pencil/icon.svg",
    "stylesheet": "tools/pencil/pencil.css"
});


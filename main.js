var canvas = document.getElementById('canvas');
var ctx    = canvas.getContext('2d');

const W = canvas.width, H = canvas.height;
const CW = W / 2, CH = H / 2;

// Convert degrees to radians
function radians(x) {
	return x * 180 / 3.14;
}

// Constants for the projection matrix
const A = W / H;
const FOV = 90;
const near = 0.1; 				// near clipping plane
const far  = 1000;				// far clipping plane
const N = far / (far - near)	// Z-normalization
const Q = -near * N;
const F = 1 / Math.tan(radians(FOV / 2))

const fps = 1000;
const tick = 1000 / fps;

let cos = (x) => { return Math.cos(radians(x)); }
let sin = (x) => { return Math.sin(radians(x)); }

// The projection matrix
let projection_matrix = [
	[A * F, 0, 0, 0],
	[    0, F, 0, 0],
	[    0, 0, N, 1],
	[    0, 0, Q, 0],
]

// color palette
black = 'rgba(0, 0, 0, 255)'
white = 'rgba(255, 255, 255, 255)'

// Shorthand rendering functions
function Rect(x=0, y=0, w=W, h=H, color=black) {
	ctx.fillStyle = color;
	ctx.fillRect(x, y, w, h);
}

function Line(x1, y1, x2, y2, color=white) {
	ctx.beginPath();
	ctx.strokeStyle = color;
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2)
	ctx.stroke();
}

function Triangle(x1, y1, x2, y2, x3, y3, outline_color=red, fill_color=white, fill=true) {
	if (fill === false) {
		// wireframe triangle
		Line(x1, y1, x2, y2, outline_color);
		Line(x2, y2, x3, y3, outline_color);
		Line(x3, y3, x1, y1, outline_color);
	}

	else {
		// Rasterize the triangle
		ctx.beginPath();
		
		ctx.fillStyle = fill_color;
		ctx.strokeStyle = outline_color;

		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.lineTo(x3, y3);
		ctx.lineTo(x1, y1);

		ctx.stroke()
		ctx.fill();
	}
}


// perform a - b on the two vectors
function subtract(a, b) {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}


// return magnitude of a vector
function size(n) {
	return n[0] ** 2 + n[1] ** 2 + n[2] ** 2
}


// normalize a vector into a unit vector
function normalize(n) {
	let s = size(n);
	return [n[0] / s, n[1] / s, n[2] / s];

}


// dot product of two vectors
function dot(a, b) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}


// get surface normal for a triangle
function normal(a, b, c) {
	let l1 = subtract(b, a);
	let l2 = subtract(b, c);
	let n = [l1[1] * l2[2] - l1[2] * l2[1], l1[2] * l2[0] - l1[0] * l2[2], l1[0] * l2[1] - l1[1] * l2[0]];
	return normalize(n);
}


// offset a point into canvas view space
function offset(p) {
	return [(p[0] + 1) * CW, (p[1] + 1) * CH]
}


// multiply a 4 component vector with a 4x4 matrix
function multiply(p, mat4) {
	v = [0, 0, 0]
	v[0] = p[0] * mat4[0][0] + p[1] * mat4[1][0] + p[2] * mat4[2][0] + mat4[3][0];
	v[1] = p[0] * mat4[0][1] + p[1] * mat4[1][1] + p[2] * mat4[2][1] + mat4[3][1];
	v[2] = p[0] * mat4[0][2] + p[1] * mat4[1][2] + p[2] * mat4[2][2] + mat4[3][2];
	w    = p[0] * mat4[0][3] + p[1] * mat4[1][3] + p[2] * mat4[2][3] + mat4[3][3];

	if (w != 0.0) { v[0] = v[0] / w; v[1] = v[1] / w; v[2] = v[2] / w; }
	return v
}


// rotate a point around the (world space) origin, by an angle "x"
function rotateZX(p, x) {
	let rotZX = [
		[cos(x), -sin(x)*cos(x),    sin(x) ** 2, 0],
		[sin(x),    cos(x) ** 2, -cos(x)*sin(x), 0],
		[     0,         sin(x),         cos(x), 0],
		[     0,              0,              0, 1],
	]

	v = multiply(p, rotZX)
	return [v[0], v[1], v[2] + 5] // shift the point away from the viewport
}

// slight lighting, based distance from light source
function get_color(L) {
	let i = 255 * Math.abs(L);
	return 'rgba(' + i  + ', ' + i + ',' + i + ', 255)' 
}


// Triangulated mesh defining a 'cube' in world space
cube = [
	[0,0,0, 0,1,0, 1,1,0], [0,0,0, 1,1,0, 1,0,0], [1,0,0, 1,1,0, 1,1,1],
	[1,0,0, 1,1,1, 1,0,1], [1,0,1, 1,1,1, 0,1,1], [1,0,1, 0,1,1, 0,0,1],
	[0,0,1, 0,1,1, 0,1,0], [0,0,1, 0,1,0, 0,0,0], [0,1,0, 0,1,1, 1,1,1],
	[0,1,0, 1,1,1, 1,1,0], [1,0,1, 0,0,1, 0,0,0], [1,0,1, 0,0,0, 1,0,0],
]

// angle (for rotation matrices)
let x = 0;

let camera = [0, 0, 0];
let light  = normalize([0, 0, -1]);

// the render loop
function Run() {
	Rect(); // clear canvas

	x += 0.0001

	cube.forEach((triangle) => {
			let p1 = [triangle[0], triangle[1], triangle[2]]
			let p2 = [triangle[3], triangle[4], triangle[5]]
			let p3 = [triangle[6], triangle[7], triangle[8]]

			p1 = rotateZX(p1, x)
			p2 = rotateZX(p2, x)
			p3 = rotateZX(p3, x)

			let n = normal(p1, p2, p3);
			let translated = subtract(camera, p1);
			let L = get_color(dot(n, light));

			if (dot(n, translated) < 0.0) {

				p1 = offset(multiply(p1, projection_matrix));
				p2 = offset(multiply(p2, projection_matrix));
				p3 = offset(multiply(p3, projection_matrix));
			
				Triangle(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], L, L, true)
			}
		}
	)

}

// window.requestAnimationFrame(Run);
setInterval(Run, tick);
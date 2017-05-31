(function (window, localStorage, Math, document, setTimeout, round, floor) {
var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame;

var drawImage = 'drawImage';

function $ (id) {
	return document.getElementById(id);
}

function vibrate () {
	try {
		navigator.vibrate(100);
	} catch (e) {
	}
}

var playSound = (function() {
	var soundContext = window.AudioContext || window.webkitAudioContext, lastV = 0, gain = 0;
	if (!soundContext) {
		return function () {};
	}
	soundContext = new soundContext();
	var oscillator = soundContext.createOscillator();
	oscillator.frequency.value = 220;

	var modulationGain = soundContext.createGain();
	modulationGain.gain.value = 0;

	oscillator.connect(modulationGain);
	modulationGain.connect(soundContext.destination);
	oscillator.start();

	return function (v) {
		if (v < 0) {
			gain = 0;
		} else {
			oscillator.frequency.value = 220 * Math.pow(2, v);
			gain = Util_limit(gain + 10 * Math.abs(lastV - v) - 0.02, 0, 0.5);
			lastV = v;
		}
		modulationGain.gain.value = gain;
	};
})();

function getKey (style, car, road) {
return style + '-' + car + '-' + road;
}

var localStorageKey = 'racer-records';

function updateRecord (key, time) {
	var old, all;
	if (time.length > 9) {
		return false;
	}
	old = getRecord(key);
	if (!old || old > time) {
		try {
			all = JSON.parse(localStorage[localStorageKey] || '{}');
			all[key] = time;
			localStorage[localStorageKey] = JSON.stringify(all);
			return true;
		} catch (e) {
		}
	}
	return false;
}

function getRecord (key) {
	try {
		return JSON.parse(localStorage[localStorageKey])[key];
	} catch (e) {
	}
}


var COLORS, SPRITES;

//=========================================================================
// general purpose helpers (mostly math)
//=========================================================================

  function Util_timestamp()                  { return Date.now();                                    }
  function Util_toInt(obj, def)          { if (obj !== null) { var x = parseInt(obj, 10); if (!isNaN(x)) return x; } return Util_toInt(def, 0); }
  function Util_toFloat(obj, def)          { if (obj !== null) { var x = parseFloat(obj);   if (!isNaN(x)) return x; } return Util_toFloat(def, 0.0); }
  function Util_limit(value, min, max)   { return Math.max(min, Math.min(value, max));                     }
  function Util_randomInt(min, max)          { return round(Util_interpolate(min, max, Math.random()));   }
  function Util_randomChoice(options)           { return options[Util_randomInt(0, options.length-1)];            }
  function Util_percentRemaining(n, total)          { return (n%total)/total;                                         }
  function Util_accelerate(v, accel, dt)      { return v + (accel * dt);                                        }
  function Util_interpolate(a,b,percent)       { return a + (b-a)*percent                                        }
  function Util_easeIn(a,b,percent)       { return a + (b-a)*Math.pow(percent,2);                           }
  function Util_easeOut(a,b,percent)       { return a + (b-a)*(1-Math.pow(1-percent,2));                     }
  function Util_easeInOut(a,b,percent)       { return a + (b-a)*((-Math.cos(percent*Math.PI)/2) + 0.5);        }
  function Util_exponentialFog(distance, density) { return 1 / (Math.pow(Math.E, (distance * distance * density))); }

  function Util_increase(start, increment, max) { // with looping
    var result = start + increment;
    while (result >= max)
      result -= max;
    while (result < 0)
      result += max;
    return result;
  }

  function Util_project(p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {
    p.c.x     = (p.w.x || 0) - cameraX;
    p.c.y     = (p.w.y || 0) - cameraY;
    p.c.z     = (p.w.z || 0) - cameraZ;
    p.s.s = cameraDepth/p.c.z;
    p.s.x     = round((width/2)  + (p.s.s * p.c.x  * width/2));
    p.s.y     = round((height/2) - (p.s.s * p.c.y  * height/2));
    p.s.w     = round(             (p.s.s * roadWidth   * width/2));
  }

  function Util_overlap(x1, w1, x2, w2, percent) {
    var half = (percent || 1)/2;
    var min1 = x1 - (w1*half);
    var max1 = x1 + (w1*half);
    var min2 = x2 - (w2*half);
    var max2 = x2 + (w2*half);
    return ! ((max1 < min2) || (min1 > max2));
  }

//=========================================================================
// canvas rendering helpers
//=========================================================================

  function Render_polygon(ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  //---------------------------------------------------------------------------

  function Render_segment(ctx, width, lanes, x1, y1, w1, x2, y2, w2, fog, color) {

    var r1 = Render_rumbleWidth(w1, lanes),
        r2 = Render_rumbleWidth(w2, lanes),
        l1 = Render_laneMarkerWidth(w1, lanes),
        l2 = Render_laneMarkerWidth(w2, lanes),
        lanew1, lanew2, lanex1, lanex2, lane;
    
    ctx.fillStyle = color.g;
    ctx.fillRect(0, y2, width, y1 - y2);
    
    Render_polygon(ctx, x1-w1-r1, y1, x1-w1, y1, x2-w2, y2, x2-w2-r2, y2, color.R);
    Render_polygon(ctx, x1+w1+r1, y1, x1+w1, y1, x2+w2, y2, x2+w2+r2, y2, color.R);
    Render_polygon(ctx, x1-w1,    y1, x1+w1, y1, x2+w2, y2, x2-w2,    y2, color.r);
    
    if (color.l) {
      lanew1 = w1*2/lanes;
      lanew2 = w2*2/lanes;
      lanex1 = x1 - w1 + lanew1;
      lanex2 = x2 - w2 + lanew2;
      for(lane = 1 ; lane < lanes ; lanex1 += lanew1, lanex2 += lanew2, lane++)
        Render_polygon(ctx, lanex1 - l1/2, y1, lanex1 + l1/2, y1, lanex2 + l2/2, y2, lanex2 - l2/2, y2, color.l);
    }
    
    Render_fog(ctx, 0, y1, width, y2-y1, fog);
  }

  //---------------------------------------------------------------------------

  function Render_background(ctx, background, width, height, layer, rotation, offset) {

    rotation = rotation || 0;
    offset   = offset   || 0;

    var imageW = layer.w/2;
    var imageH = layer.h;

    var sourceX = layer.x + floor(layer.w * rotation);
    var sourceY = layer.y
    var sourceW = Math.min(imageW, layer.x+layer.w-sourceX);
    var sourceH = imageH;
    
    var destX = 0;
    var destY = offset;
    var destW = floor(width * (sourceW/imageW));
    var destH = height;

    if (sourceW)
      ctx[drawImage](background, sourceX, sourceY, sourceW, sourceH, destX, destY, destW, destH);
    if (sourceW < imageW)
      ctx[drawImage](background, layer.x, sourceY, imageW-sourceW, sourceH, destW, destY, width-destW, destH); //destW - 1?
  }

  //---------------------------------------------------------------------------

  function Render_sprite(ctx, width, height, resolution, roadWidth, sprites, sprite, scale, destX, destY, offsetX, offsetY, clipY) {

                    //  scale for projection AND relative to roadWidth (for tweakUI)
    var destW  = (sprite.w * scale * width/2) * (SPRITES.SCALE * roadWidth);
    var destH  = (sprite.h * scale * width/2) * (SPRITES.SCALE * roadWidth);

    destX = destX + (destW * (offsetX || 0));
    destY = destY + (destH * (offsetY || 0));

    var clipH = clipY ? Math.max(0, destY+destH-clipY) : 0;
    if (clipH < destH)
      ctx[drawImage](sprites, sprite.x, sprite.y, sprite.w, sprite.h - (sprite.h*clipH/destH), destX, destY, destW, destH - clipH);

  }

  //---------------------------------------------------------------------------

  function Render_player(ctx, width, height, resolution, roadWidth, sprites, speedPercent, scale, destX, destY, steer, updown) {

    var bounce = (1.5 * Math.random() * speedPercent * resolution) * Util_randomChoice([-1,1]);
    var sprite;
    if (steer < 0)
      sprite = SPRITES.PLAYER_LEFT;//(updown > 0) ? SPRITES.PLAYER_UPHILL_LEFT : SPRITES.PLAYER_LEFT;
    else if (steer > 0)
      sprite = SPRITES.PLAYER_RIGHT;//(updown > 0) ? SPRITES.PLAYER_UPHILL_RIGHT : SPRITES.PLAYER_RIGHT;
    else
      sprite = SPRITES.PLAYER_STRAIGHT;//(updown > 0) ? SPRITES.PLAYER_UPHILL_STRAIGHT : SPRITES.PLAYER_STRAIGHT;

    Render_sprite(ctx, width, height, resolution, roadWidth, sprites, sprite, scale, destX, destY + bounce, -0.5, -1);
  }

  //---------------------------------------------------------------------------

  function Render_fog(ctx, x, y, width, height, fog) {
    if (fog < 1) {
      ctx.globalAlpha = (1-fog)
      ctx.fillStyle = COLORS.FOG;
      ctx.fillRect(x, y, width, height);
      ctx.globalAlpha = 1;
    }
  }

  function Render_rumbleWidth(projectedRoadWidth, lanes) { return projectedRoadWidth/Math.max(6,  2*lanes); }
  function Render_laneMarkerWidth(projectedRoadWidth, lanes) { return projectedRoadWidth/Math.max(32, 8*lanes); }


var BACKGROUND = {
  HILLS: { x:   5, y:   5, w: 1280, h: 480 },
  SKY:   { x:   5, y: 495, w: 1280, h: 480 },
  TREES: { x:   5, y: 985, w: 1280, h: 480 }
};

function setColorsSprites (style, carColor) {
SPRITES={
PLAYER_LEFT: {x: 800, y: 42 * carColor, w: 80, h: 41},
PLAYER_STRAIGHT: {x: 880, y: 42 * carColor, w: 80, h: 41},
PLAYER_RIGHT: {x: 960, y: 42 * carColor, w: 80, h: 41},
C1: {x: 880, y: 0, w: 80, h: 41},
C2: {x: 880, y: 42, w: 80, h: 41},
C3: {x: 880, y: 84, w: 80, h: 41},
C4: {x: 880, y: 126, w: 80, h: 41},

B1: {x: 5, y: 0, w: 350, h: 285},
B2: {x: 400, y: 0, w: 350, h: 285},
P1: {x: 30, y: 310, w: 385, h: 400},
P2: {x: 470, y: 310, w: 360, h: 400},
P3: {x: 900, y: 300, w: 390, h: 420},
P4: {x: 40, y: 820, w: 430, h: 460},
P5: {x: 500, y: 810, w: 260, h: 240},
X: {x: 1400, y: 5, w: 30, h: 700}
};
SPRITES.CARS=[SPRITES.C1,SPRITES.C2,SPRITES.C3,SPRITES.C4];
SPRITES.SCALE = 0.3 * (1/SPRITES.PLAYER_STRAIGHT.w);

switch(style) {
case 0: //forest
COLORS = {
  SKY:  '#72D7EE',
  TREE: '#005108',
  FOG:  '#005108',
  HILL: {t: '#be5', m: '#22a822', b: '#1a1'},
  LIGHT:  { r: '#6B6B6B', g: '#1a1', R: '#555', l: '#ccc'  }, //r: road, g: grass, R: rumble, l: lane
  DARK:   { r: '#696969', g: '#090', R: '#bbb'                },
  START:  { r: '#ccc',    g: '#5f5', R: '#ccc'                },
  FINISH: { r: '#333',    g: '#050', R: '#333'                }
};
SPRITES.OBJECTS=[SPRITES.B1,SPRITES.B2,SPRITES.P1,SPRITES.P2,SPRITES.P2,SPRITES.X];
break;
case 1: //desert
COLORS = {
  SKY:  '#77f',
  TREE: '#880',
  FOG:  '#884',
  HILL: {t: '#ff5', m: '#ee3', b: '#dd0'},
  LIGHT:  { r: '#6B6B6B', g: '#dd0', R: '#f00', l: '#ccc'  },
  DARK:   { r: '#696969', g: '#bb0', R: '#bbb'                },
  START:  { r: '#ccc',    g: '#ff3', R: '#ccc'                },
  FINISH: { r: '#333',    g: '#880', R: '#333'                }
};
SPRITES.OBJECTS=[SPRITES.B1,SPRITES.B2,SPRITES.P4,SPRITES.P4,SPRITES.P5,SPRITES.X];
break;
case 2: //snow
COLORS = {
  SKY:  '#8af',
  TREE: '#888',
  FOG:  '#aaa',
  HILL: {t: '#fff', m: '#ddd', b: '#aaa'},
  LIGHT:  { r: '#bbb', g: '#eef', R: '#f00', l: '#ccc'  },
  DARK:   { r: '#aaa', g: '#dde', R: '#bbb'                },
  START:  { r: '#ccc',    g: '#fff', R: '#ccc'                },
  FINISH: { r: '#555',    g: '#555', R: '#555'                }
};
SPRITES.OBJECTS=[SPRITES.B1,SPRITES.B2,SPRITES.P1,SPRITES.P1,SPRITES.P3,SPRITES.X];
}
}

var dataUri = 'data:image/svg+xml;base64,', svgPre = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="';


function getCarImg (c, turn) {
	var svg = turn ? '150" height="102"><g style="stroke:#000;stroke-width:0.5px"><path d="m 13,80 8,0 0,0 0,15 L 21,94 c 0,0 -5,0 -8,-1 -1,-4 1,-13 0,-13 z" style="fill:#222"/><path d="m 16,52 c -2,4 -6,22 -5,28 0,3 2,5 5,4 -1,-2 1,-4 1,-6 -2,-3 -3,-8 2,-10 -1,-4 0,-14 2,-20 -4,1 -3,1 -5,4 z" style="fill:#eee;stroke:none"/><path d="m 20,74 c 0,0 -2,-16 0,-25 1,-2 2,0 3,-2 19,-16 27,-31 36,-33 13,-4 65,-1 65,-1 6,2 24,29 21,31 3,8 -4,20 -7,29 -12,5 -78,8 -118,1 z" style="fill:#ddd;stroke:none"/><path d="m 147,61 c -2,-3 -6,-6 -4,-8 1,-13 0,-17 -2,-19 9,-3 6,23 6,27 z" style="fill:#eee;stroke:none"/><path d="m 132,43 c -1,-2 -9,-17 -9,-23 0,-2 1,-1 3,-5 3,2 6,5 13,16 0,4 -5,9 -7,12 z" style="fill:#222"/><path d="m 148,81 -10,0 0,0 -2,17 c -1,0 8,0 12,-1 1,-4 -1,-16 0,-16 z" style="fill:#222"/><path d="m 149,51 c 0,0 1,22 0,29 -1,2 -7,4 -10,3 1,-2 1,-3 1,-4 2,-4 5,-10 -1,-11 1,-4 1,-11 2,-17 3,-2 8,-1 8,0 z" style="fill:#eee;stroke:none"/><path d="m 15,73 c -1,8 -1,15 3,22 0,0 2,1 3,2 1,0 1,1 2,1 -4,1 65,7 111,2 2,0 3,-4 3,-4 4,-5 3,-12 5,-20 1,-1 -1,-2 0,-3 -43,3 -83,4 -127,0 z" style="fill:#aaa;stroke:none"/><path d="m 120,50 -96,-1 -6,9 c 0,8 1,16 1,16 1,0 3,0 4,0 l 0,0 c 11,0 74,1 103,1 5,-1 7,0 9,-1 1,-2 1,-6 1,-7 -1,-3 0,-6 -1,-10 z" style="fill:#ccc;stroke:none"/><path d="m 19,69 c -8,1 -4,7 3,8 4,1 101,5 114,2 5,-1 10,-7 4,-11 -2,-1 1,6 -10,7 -35,0 -72,0 -102,-2 -4,0 -10,0 -9,-4 z" style="fill:#ddd;stroke:none"/><path d="m 20,94 c 37,2 76,4 112,3 l 1,-6 c -39,2 -75,1 -115,-3 z" style="fill:#222"/><path d="m 19,58 c 0,2 13,0 18,2 3,1 6,8 3,9 -2,1 -12,3 -19,0 -4,-2 -2,-6 -2,-11 z" style="fill:#800"/><path d="m 135,60 c 0,2 -18,0 -23,2 -3,0 -7,8 -4,9 2,1 16,2 23,0 6,-3 4,-6 4,-11 z" style="fill:#800"/><rect x="57" y="57" width="46" height="9" transform="matrix(1,0.012,-0.012,1,0,0)" style="fill:#fff;fill-opacity:0.7"/><path d="m 34,41 c 3,-4 10,-12 19,-21 17,-2 58,-2 67,0 2,7 2,14 4,22 z" style="fill:#222"/><path d="m 125,17 13,18" style="fill:#aaa;stroke:#999"/><path d="m 24,49 10,-8" style="fill:none"/><path d="m 120,51 4,-9" style="fill:none"/><path d="m 141,38 -1,2 2,0 z" style="fill:#333"/><path d="m 138,36 c 2,3 4,10 3,15" style="fill:none"/></g></svg>' : '151" height="103"><g style="stroke-width:0.5px;stroke:#000"><path d="m 6,80 10,0 0,0 0,18 c 0,0 0,0 0,0 0,0 -6,1 -9,0 -1,-4 0,-18 -1,-18 z" style="fill:#222"/><path d="m 8,51 c -2,4 -4,23 -4,29 2,3 4,6 7,4 -1,-1 1,-5 0,-6 -1,-3 -3,-8 4,-10 -1,-4 0,-14 1,-20 -4,2 -5,0 -8,3 z" style="fill:#eee;stroke:none"/><path d="m 15,75 c 0,0 -3,-17 1,-27 15,-13 18,-25 27,-33 12,-4 51,-4 65,-1 10,8 18,31 26,33 2,9 4,17 1,27 -13,5 -79,8 -120,1 z" style="fill:#ddd;stroke:none"/><path d="m 144,80 -9,2 0,0 0,17 c 0,0 0,0 0,0 -1,-1 5,0 9,0 2,-5 0,-19 0,-19 z" style="fill:#222"/><path d="m 142,51 c 2,4 4,23 4,28 -2,3 -4,5 -7,4 1,-1 0,-5 1,-7 2,-2 2,-6 -5,-8 1,-4 0,-14 -1,-21 4,1 5,1 8,4 z" style="fill:#eee;stroke:none"/><path d="m 10,72 c 0,10 1,18 5,26 0,0 4,4 4,2 -3,2 65,6 112,0 3,0 5,-2 5,-2 4,-7 4,-16 4,-24 -42,2 -85,4 -130,-2 z" style="fill:#aaa;stroke:none"/><path d="m 124,50 -98,0 -12,8 c 0,8 1,16 1,16 1,0 3,0 4,1 0,0 0,0 0,0 11,0 75,0 103,0 6,-1 10,-1 12,-3 2,-5 2,-10 1,-16 l -11,-6 z" style="fill:#ccc;stroke:none"/><path d="m 15,68 c -8,2 -7,12 3,12 2,0 101,2 114,-1 6,0 14,-7 4,-11 -2,-1 0,6 -10,6 -35,1 -71,2 -102,1 -4,-1 -9,-1 -9,-7 z" style="fill:#ddd;stroke:none"/><path d="m 18,96 c 37,3 80,2 116,0 l 1,-5 c -40,3 -79,4 -120,0 z" style="fill:#222"/><path d="m 15,59 c -1,3 17,1 23,3 4,0 6,8 4,9 -3,1 -16,3 -24,0 -6,-3 -4,-7 -3,-12 z" style="fill:#800"/><path d="m 135,59 c 1,3 -17,1 -23,3 -4,0 -6,8 -4,9 3,0 16,1 24,0 6,-3 4,-7 3,-12 z" style="fill:#800"/><rect x="51" y="62" width="46" height="9" style="fill:#fff;fill-opacity:0.7;"/><path d="m 30,41 c 1,-5 2,-9 12,-21 20,-1 42,-1 68,0 4,7 9,13 10,21 z" style="fill:#222"/><path d="m 27,50 3,-9"/><path d="m 124,50 -4,-9"/></g></svg>';
	c = [
		['#e00', '#d00', '#c00', '#a00'],
		['#00e', '#00d', '#00c', '#00a'],
		['#ee0', '#dd0', '#cc0', '#aa0'],
		['#0e0', '#0d0', '#0c0', '#0a0']
	][c];
	svg = svgPre + svg.replace(/#eee/g, c[0]).replace(/#ddd/g, c[1]).replace(/#ccc/g, c[2]).replace(/#aaa/g, c[3]);
	return dataUri + btoa(svg);
}

function getTree () {
	var svg = svgPre + '430" height="333"><g fill="#050"><text font-family="sans-serif" x="0" y="117" font-size="117">&#x1F332;&#x1F333;&#x1F384;</text><text font-family="sans-serif" x="0" y="300" font-size="133">&#x1F334;</text><text font-family="sans-serif" x="167" y="233" font-size="67">&#x1F335;</text></g></svg>';
	return dataUri + btoa(svg);
}

function makeBackground () {
var c = document.createElement('canvas');
var bezierCurveTo = 'bezierCurveTo';
c.width = 1290;
c.height = 1470;
var canvas = c.getContext('2d');
var grad1 = canvas.createLinearGradient(0, 0, 0, 485),
	grad2 = canvas.createLinearGradient(5, 495, 5, 975);
grad1.addColorStop(0.15, COLORS.HILL.t);
grad1.addColorStop(0.5, COLORS.HILL.m);
grad1.addColorStop(1, COLORS.HILL.b);
canvas.fillStyle = grad1;
canvas.beginPath();
canvas.moveTo(5, 485);
canvas.lineTo(1285, 485);
canvas.lineTo(1285, 120);
canvas[bezierCurveTo](1100, 180, 1100, 80, 1000, 90);
canvas[bezierCurveTo](900, 100, 900, 130, 800, 140);
canvas[bezierCurveTo](700, 150, 700, 85, 650, 85);
canvas[bezierCurveTo](600, 85, 600, 90, 580, 100);
canvas[bezierCurveTo](560, 110, 460, 30, 390, 40);
canvas[bezierCurveTo](320, 50, 310, 120, 250, 130);
canvas[bezierCurveTo](190, 140, 190, 60, 5, 120);
canvas.closePath();
canvas.fill();

grad2.addColorStop(0, COLORS.SKY);
grad2.addColorStop(0.4, '#fff');
canvas.fillStyle = grad2;
canvas.beginPath();
canvas.moveTo(5, 495);
canvas.lineTo(5, 975);
canvas.lineTo(1285, 975);
canvas.lineTo(1285, 495);
canvas.closePath();
canvas.fill();
canvas.fillStyle = '#fff';
canvas.beginPath();
canvas.arc(180, 535, 10, 0, 2 * Math.PI);
canvas.arc(200, 530, 20, 0, 2 * Math.PI);
canvas.arc(210, 520, 15, 0, 2 * Math.PI);
canvas.arc(220, 530, 15, 0, 2 * Math.PI);
canvas.closePath();
canvas.fill();
canvas.beginPath();
canvas.arc(380, 545, 10, 0, 2 * Math.PI);
canvas.arc(400, 540, 20, 0, 2 * Math.PI);
canvas.arc(410, 530, 10, 0, 2 * Math.PI);
canvas.arc(420, 540, 15, 0, 2 * Math.PI);
canvas.arc(430, 540, 10, 0, 2 * Math.PI);
canvas.closePath();
canvas.fill();
canvas.beginPath();
canvas.arc(680, 545, 10, 0, 2 * Math.PI);
canvas.arc(695, 540, 20, 0, 2 * Math.PI);
canvas.arc(710, 535, 15, 0, 2 * Math.PI);
canvas.arc(720, 540, 15, 0, 2 * Math.PI);
canvas.closePath();
canvas.fill();
canvas.beginPath();
canvas.arc(980, 555, 10, 0, 2 * Math.PI);
canvas.arc(1000, 550, 20, 0, 2 * Math.PI);
canvas.arc(1010, 555, 15, 0, 2 * Math.PI);
canvas.closePath();
canvas.fill();

canvas.fillStyle = COLORS.TREE;
canvas.beginPath();
canvas.moveTo(5, 1175);
canvas.lineTo(5, 1465);
canvas.lineTo(1285, 1465);
canvas.lineTo(1285, 1175);
var y = 1175;
for (var x = 1285; x > 5; x--) {
	y += round(Math.random() * 2 - 1 - (y - 1175) / x);
	canvas.lineTo(x, y);
}
canvas.closePath();
canvas.fill();

return c;
}

function makeSprites (cars) {
var c = document.createElement('canvas');
c.width = 1492;
c.height = 1487;
var canvas = c.getContext('2d');
var grad = canvas.createLinearGradient(0, 5, 0, 255);
grad.addColorStop(0, '#ff0');
grad.addColorStop(1, '#c80');
canvas.strokeStyle = '#000';
canvas.lineWidth = 6;
canvas.fillStyle = grad;
canvas.rect(5, 5, 350, 250);
canvas.fill();
canvas.moveTo(5, 255)
canvas.lineTo(5, 285);
canvas.moveTo(355, 255)
canvas.lineTo(355, 285);

canvas.rect(400, 5, 350, 250);
canvas.fill();
canvas.moveTo(400, 255)
canvas.lineTo(400, 285);
canvas.moveTo(750, 255)
canvas.lineTo(750, 285);
canvas.stroke();
canvas.font = '100px sans-serif';
canvas.fillStyle = '#c00';
canvas.fillText('Fire!', 75, 155);
canvas.fillText('Fox!', 475, 155);
/*canvas.font = '350px sans-serif';
canvas.fillStyle = '#050';
canvas.fillText('🌲🌳🎄', 0, 650);
canvas.font = '400px sans-serif';
canvas.fillText('🌴', 0, 1200);
canvas.font = '200px sans-serif';
canvas.fillText('🌵', 500, 1000);*/
canvas.fillStyle = '#ccc';
canvas.beginPath();
canvas.rect(1400, 5, 30, 700);
canvas.fill();

var c2 = document.createElement('canvas');
c2.width = 430;
c2.height = 333;
//drawing emojis directly on a canvas doesn't work at all
//drawing them via SVG in a big size makes them monochrome
//so draw them from SVG to canvas first and scale up then
c2.getContext('2d')[drawImage](cars[8], 0, 0); //plants
canvas[drawImage](c2, 0, 300, 1290, 999);

//sizes are wrong, but doesn't matter
canvas[drawImage](cars[0], 880,0, 80,41);
canvas[drawImage](cars[1], 960,0, 80,41);

canvas[drawImage](cars[2], 880,42, 80,41);
canvas[drawImage](cars[3], 960,42, 80,41);

canvas[drawImage](cars[4], 880,84, 80,41);
canvas[drawImage](cars[5], 960,84, 80,41);

canvas[drawImage](cars[6], 880,126, 80,41);
canvas[drawImage](cars[7], 960,126, 80,41);

canvas.scale(-1, 1);
canvas[drawImage](cars[1], -880,0, 80,41);
canvas[drawImage](cars[3], -880,42, 80,41);
canvas[drawImage](cars[5], -880,84, 80,41);
canvas[drawImage](cars[7], -880,126, 80,41);

return c;
};

function loadImages (names, callback) { // load multiple images and callback when ALL images have loaded
    var result = [];
    var count  = names.length;

    var onload = function() {
      if (--count == 0)
        callback(result);
    };

    for(var n = 0 ; n < names.length ; n++) {
      var name = names[n];
      result[n] = document.createElement('img');
      result[n].onload = onload;
      result[n].src = name;
    }
  }

var details = 2; //1 for slow devices, up to 20 for fast
    var fps            = 60;                      // how many 'update' frames per second
    var step           = 1/fps;                   // how long is each frame (in seconds)
    var width          = 320;//480;                     // logical canvas width
    var height         = 240;//360;                     // logical canvas height
    var centrifugal    = 0.3;                     // centrifugal force multiplier when going around curves
    var offRoadDecel   = 0.99;                    // speed multiplier when off road (e.g. you lose 2% speed each update frame)
    var skySpeed       = 0.001;                   // background sky layer scroll speed when going around curve (or up hill)
    var hillSpeed      = 0.002;                   // background hill layer scroll speed when going around curve (or up hill)
    var treeSpeed      = 0.003;                   // background tree layer scroll speed when going around curve (or up hill)
    var skyOffset      = 0;                       // current sky scroll offset
    var hillOffset     = 0;                       // current hill scroll offset
    var treeOffset     = 0;                       // current tree scroll offset
    var segments       = [];                      // array of road segments
    var cars           = [];                      // array of cars on the road
    var canvas         = $('c');       // our canvas...
    var ctx            = canvas.getContext('2d'); // ...and its drawing context
    var background     = null;                    // our background image (loaded below)
    var sprites        = null;                    // our spritesheet (loaded below)
    var resolution     = null;                    // scaling factor to provide resolution independence (computed)
    var roadWidth      = 2000;                    // actually half the roads width, easier math if the road spans from -roadWidth to +roadWidth
    var segmentLength  = 200;                     // length of a single segment
    var rumbleLength   = 3;                       // number of segments per red/white rumble strip
    var trackLength    = null;                    // z length of entire track (computed)
    var lanes          = 3;                       // number of lanes
    var fieldOfView    = 100;                     // angle (degrees) for field of view
    var cameraHeight   = 1000;                    // z height of camera
    var cameraDepth    = null;                    // z distance camera is from screen (computed)
    var drawDistance   = 300;                     // number of segments to draw
    var playerX        = 0;                       // player x offset from center of road (-1 to 1 to stay independent of roadWidth)
    var playerZ        = null;                    // player relative z distance from camera (computed)
    var fogDensity     = 5;                       // exponential fog density
    var position       = 0;                       // current camera Z position (add playerZ to get player's absolute Z position)
    var speed          = 0;                       // current speed
    var maxSpeed       = segmentLength/step;      // top speed (ensure we can't move more than 1 segment in a single frame to make collision detection easier)
    var accel          =  maxSpeed/5;             // acceleration rate - tuned until it 'felt' right
    var breaking       = -maxSpeed;               // deceleration rate when braking
    var decel          = -maxSpeed/5;             // 'natural' deceleration rate when neither accelerating, nor braking
    var offRoadDecel   = -maxSpeed/2;             // off road deceleration is somewhere in between
    var offRoadLimit   =  maxSpeed/4;             // limit when off road deceleration no longer applies (e.g. you can always go at least this speed even when off road)
    var totalCars      = 10 * details;                      // total number of cars on the road
    var lapCount       = 0;
    var currentTime    = 0;
    var totalLaps      = 1;

    var keyLeft        = false;
    var keyRight       = false;
    var keyFaster      = false;
    var keySlower      = false;


function resize () {
	var docEl = document.documentElement, w = docEl.clientWidth, h = docEl.clientHeight, scale, style;
	if (w / h > width / height) {
		scale = h / height;
	} else {
		scale = w / width;
	}
	style = canvas.style;
	style.transform = 'scale(' + scale + ')';
	style.top = ((scale - 1) * height / 2) + 'px';
	style.left = ((scale - 1) * width / 2 + (w - width * scale) / 2) + 'px';
	style.display = 'block';
}


    //=========================================================================
    // UPDATE THE GAME WORLD
    //=========================================================================

    function update(dt) {

      var n, car, carW, sprite, spriteW;
      var playerSegment = findSegment(position+playerZ);
      var playerW       = SPRITES.PLAYER_STRAIGHT.w * SPRITES.SCALE;
      var speedPercent  = speed/maxSpeed;
      var dx            = dt * 2 * speedPercent; // at top speed, should be able to cross from left to right (-1 to 1) in 1 second
      var startPosition = position;

      updateCars(dt, playerSegment, playerW);

      position = Util_increase(position, dt * speed, trackLength);

      if (keyLeft)
        playerX = playerX - dx;
      else if (keyRight)
        playerX = playerX + dx;

      playerX = playerX - (dx * speedPercent * playerSegment.curve * centrifugal);

      if (keyFaster)
        speed = Util_accelerate(speed, accel, dt);
      else if (keySlower)
        speed = Util_accelerate(speed, breaking, dt);
      else
        speed = Util_accelerate(speed, decel, dt);


      if ((playerX < -1) || (playerX > 1)) {

        if (speed > offRoadLimit)
          speed = Util_accelerate(speed, offRoadDecel, dt);

        for(n = 0 ; n < playerSegment.s.length ; n++) {
          sprite  = playerSegment.s[n];
          spriteW = sprite.source.w * SPRITES.SCALE;
          if (Util_overlap(playerX, playerW, sprite.o + spriteW/2 * (sprite.o > 0 ? 1 : -1), spriteW)) {
            speed = maxSpeed/5;
            position = Util_increase(playerSegment.p1.w.z, -playerZ, trackLength); // stop in front of sprite (at front of segment)
			vibrate();
            break;
          }
        }
      }

      for(n = 0 ; n < playerSegment.cars.length ; n++) {
        car  = playerSegment.cars[n];
        carW = car.sprite.w * SPRITES.SCALE;
        if (speed > car.speed) {
          if (Util_overlap(playerX, playerW, car.o, carW, 0.8)) {
            speed    = car.speed * (car.speed/speed);
            position = Util_increase(car.z, -playerZ, trackLength);
			vibrate();
            break;
          }
        }
      }

      playerX = Util_limit(playerX, -3, 3);     // dont ever let it go too far out of bounds
      speed   = Util_limit(speed, 0, maxSpeed); // or exceed maxSpeed

		playSound(speed/maxSpeed);


      skyOffset  = Util_increase(skyOffset,  skySpeed  * playerSegment.curve * (position-startPosition)/segmentLength, 1);
      hillOffset = Util_increase(hillOffset, hillSpeed * playerSegment.curve * (position-startPosition)/segmentLength, 1);
      treeOffset = Util_increase(treeOffset, treeSpeed * playerSegment.curve * (position-startPosition)/segmentLength, 1);

		currentTime += dt;
		if (position > playerZ && startPosition < playerZ) {
			lapCount++;
			if (lapCount > totalLaps) {
				lapCount = totalLaps;
				return true;
			}
		}
    }

    //-------------------------------------------------------------------------

    function updateCars(dt, playerSegment, playerW) {
      var n, car, oldSegment, newSegment, index;
      for(n = 0 ; n < cars.length ; n++) {
        car         = cars[n];
        oldSegment  = findSegment(car.z);
        car.o  = car.o + updateCarOffset(car, oldSegment, playerSegment, playerW);
        car.z       = Util_increase(car.z, dt * car.speed, trackLength);
        car.percent = Util_percentRemaining(car.z, segmentLength); // useful for interpolation during rendering phase
        newSegment  = findSegment(car.z);
        if (oldSegment != newSegment) {
          index = oldSegment.cars.indexOf(car);
          oldSegment.cars.splice(index, 1);
          newSegment.cars.push(car);
        }
      }
    }

    function updateCarOffset(car, carSegment, playerSegment, playerW) {

      var i, j, dir, segment, otherCar, otherCarW, lookahead = 20, carW = car.sprite.w * SPRITES.SCALE;

      // optimization, dont bother steering around other cars when 'out of sight' of the player
      if ((carSegment.n - playerSegment.n) > drawDistance)
        return 0;

      for(i = 1 ; i < lookahead ; i++) {
        segment = segments[(carSegment.n+i)%segments.length];

        if ((segment === playerSegment) && (car.speed > speed) && (Util_overlap(playerX, playerW, car.o, carW, 1.2))) {
          if (playerX > 0.5)
            dir = -1;
          else if (playerX < -0.5)
            dir = 1;
          else
            dir = (car.o > playerX) ? 1 : -1;
          return dir * 1/i * (car.speed-speed)/maxSpeed; // the closer the cars (smaller i) and the greated the speed ratio, the larger the offset
        }

        for(j = 0 ; j < segment.cars.length ; j++) {
          otherCar  = segment.cars[j];
          otherCarW = otherCar.sprite.w * SPRITES.SCALE;
          if ((car.speed > otherCar.speed) && Util_overlap(car.o, carW, otherCar.o, otherCarW, 1.2)) {
            if (otherCar.o > 0.5)
              dir = -1;
            else if (otherCar.o < -0.5)
              dir = 1;
            else
              dir = (car.o > otherCar.o) ? 1 : -1;
            return dir * 1/i * (car.speed-otherCar.speed)/maxSpeed;
          }
        }
      }

      // if no cars ahead, but I have somehow ended up off road, then steer back on
      if (car.o < -0.9)
        return 0.1;
      else if (car.o > 0.9)
        return -0.1;
      else
        return 0;
    }

    //-------------------------------------------------------------------------

function formatTime(dt) {
	var minutes = floor(dt/60);
	var seconds = floor(dt - (minutes * 60));
	var tenths  = floor(10 * (dt - floor(dt)));
	if (minutes < 10) {
		minutes = ' ' + minutes;
	}
	return minutes + ":" + (seconds < 10 ? "0" : "") + seconds + "." + tenths;
}

    //=========================================================================
    // RENDER THE GAME WORLD
    //=========================================================================

    function render() {

      var baseSegment   = findSegment(position);
      var basePercent   = Util_percentRemaining(position, segmentLength);
      var playerSegment = findSegment(position+playerZ);
      var playerPercent = Util_percentRemaining(position+playerZ, segmentLength);
      var playerY       = Util_interpolate(playerSegment.p1.w.y, playerSegment.p2.w.y, playerPercent);
      var maxy          = height;

      var x  = 0;
      var dx = - (baseSegment.curve * basePercent);

      ctx.clearRect(0, 0, width, height);

      Render_background(ctx, background, width, height, BACKGROUND.SKY,   skyOffset,  resolution * skySpeed  * playerY);
      Render_background(ctx, background, width, height, BACKGROUND.HILLS, hillOffset, resolution * hillSpeed * playerY);
      Render_background(ctx, background, width, height, BACKGROUND.TREES, treeOffset, resolution * treeSpeed * playerY);

      var n, i, segment, car, sprite, spriteScale, spriteX, spriteY;

      for(n = 0 ; n < drawDistance ; n++) {

        segment        = segments[(baseSegment.n + n) % segments.length];
        segment.looped = segment.n < baseSegment.n;
        segment.f    = Util_exponentialFog(n/drawDistance, fogDensity);
        segment.clip   = maxy;

        Util_project(segment.p1, (playerX * roadWidth) - x,      playerY + cameraHeight, position - (segment.looped ? trackLength : 0), cameraDepth, width, height, roadWidth);
        Util_project(segment.p2, (playerX * roadWidth) - x - dx, playerY + cameraHeight, position - (segment.looped ? trackLength : 0), cameraDepth, width, height, roadWidth);

        x  = x + dx;
        dx = dx + segment.curve;

        if ((segment.p1.c.z <= cameraDepth)         || // behind us
            (segment.p2.s.y >= segment.p1.s.y) || // back face cull
            (segment.p2.s.y >= maxy))                  // clip by (already rendered) hill
          continue;

        Render_segment(ctx, width, lanes,
                       segment.p1.s.x,
                       segment.p1.s.y,
                       segment.p1.s.w,
                       segment.p2.s.x,
                       segment.p2.s.y,
                       segment.p2.s.w,
                       segment.f,
                       segment.c);

        maxy = segment.p1.s.y;
      }

      for(n = (drawDistance-1) ; n > 0 ; n--) {
        segment = segments[(baseSegment.n + n) % segments.length];

        for(i = 0 ; i < segment.cars.length ; i++) {
          car         = segment.cars[i];
          sprite      = car.sprite;
          spriteScale = Util_interpolate(segment.p1.s.s, segment.p2.s.s, car.percent);
          spriteX     = Util_interpolate(segment.p1.s.x,     segment.p2.s.x,     car.percent) + (spriteScale * car.o * roadWidth * width/2);
          spriteY     = Util_interpolate(segment.p1.s.y,     segment.p2.s.y,     car.percent);
          Render_sprite(ctx, width, height, resolution, roadWidth, sprites, car.sprite, spriteScale, spriteX, spriteY, -0.5, -1, segment.clip);
        }

        for(i = 0 ; i < segment.s.length ; i++) {
          sprite      = segment.s[i];
          spriteScale = segment.p1.s.s;
          spriteX     = segment.p1.s.x + (spriteScale * sprite.o * roadWidth * width/2);
          spriteY     = segment.p1.s.y;
          Render_sprite(ctx, width, height, resolution, roadWidth, sprites, sprite.source, spriteScale, spriteX, spriteY, (sprite.o < 0 ? -1 : 0), -1, segment.clip);
        }

        if (segment == playerSegment) {
          Render_player(ctx, width, height, resolution, roadWidth, sprites, speed/maxSpeed,
                        cameraDepth/playerZ,
                        width/2,
                        (height/2) - (cameraDepth/playerZ * Util_interpolate(playerSegment.p1.c.y, playerSegment.p2.c.y, playerPercent) * height/2),
                        speed * (keyLeft ? -1 : keyRight ? 1 : 0),
                        playerSegment.p2.w.y - playerSegment.p1.w.y);
        }
      }

	ctx.font = '12px monospace';
	ctx.fillStyle = '#000';
	ctx.fillText(('  ' + 5 * round(speed/500) + ' mph').slice(-7), 10, 15);
	ctx.fillText(formatTime(currentTime), width / 2 - 30, 15);
	ctx.fillText('Lap ' + lapCount + ' of ' + totalLaps, width - 80, 15);

    }

    function findSegment(z) {
      return segments[floor(z/segmentLength) % segments.length]; 
    }

    //=========================================================================
    // BUILD ROAD GEOMETRY
    //=========================================================================

    function lastY() { return (segments.length == 0) ? 0 : segments[segments.length-1].p2.w.y; }

    function addSegment(curve, y) {
      var n = segments.length;
      segments.push({
          n: n,
             p1: { w: { y: lastY(), z:  n   *segmentLength }, c: {}, s: {} }, //world, camera, screen
             p2: { w: { y: y,       z: (n+1)*segmentLength }, c: {}, s: {} },
          curve: curve,
        s: [],
           cars: [],
          c: floor(n/rumbleLength)%2 ? COLORS.DARK : COLORS.LIGHT
      });
    }

    function addSprite(n, sprite, offset) {
      segments[n].s.push({ source: sprite, o: offset });
    }

    function addRoad(enter, hold, leave, curve, y) {
      var startY   = lastY();
      var endY     = startY + (Util_toInt(y, 0) * segmentLength);
      var n, total = enter + hold + leave;
      for(n = 0 ; n < enter ; n++)
        addSegment(Util_easeIn(0, curve, n/enter), Util_easeInOut(startY, endY, n/total));
      for(n = 0 ; n < hold  ; n++)
        addSegment(curve, Util_easeInOut(startY, endY, (enter+n)/total));
      for(n = 0 ; n < leave ; n++)
        addSegment(Util_easeInOut(curve, 0, n/leave), Util_easeInOut(startY, endY, (enter+hold+n)/total));
    }

    var ROAD_LENGTH_NONE= 0, ROAD_LENGTH_SHORT=  25, ROAD_LENGTH_MEDIUM=   50, ROAD_LENGTH_LONG=  100,
      ROAD_HILL_NONE= 0, ROAD_HILL_LOW=    20, ROAD_HILL_MEDIUM=   40, ROAD_HILL_HIGH=   60,
      ROAD_CURVE_NONE= 0, ROAD_CURVE_EASY=    2, ROAD_CURVE_MEDIUM=    4, ROAD_CURVE_HARD=    6;

    function addStraight(num) {
      num = num || ROAD_LENGTH_MEDIUM;
      addRoad(num, num, num, 0, 0);
    }

    function addHill(num, height) {
      num    = num    || ROAD_LENGTH_MEDIUM;
      height = height || ROAD_HILL_MEDIUM;
      addRoad(num, num, num, 0, height);
    }

    function addCurve(num, curve, height) {
      num    = num    || ROAD_LENGTH_MEDIUM;
      curve  = curve  || ROAD_CURVE_MEDIUM;
      height = height || ROAD_HILL_NONE;
      addRoad(num, num, num, curve, height);
    }

    function addLowRollingHills(num, height) {
      num    = num    || ROAD_LENGTH_SHORT;
      height = height || ROAD_HILL_LOW;
      addRoad(num, num, num,  0,                height/2);
      addRoad(num, num, num,  0,               -height);
      addRoad(num, num, num,  ROAD_CURVE_EASY,  height);
      addRoad(num, num, num,  0,                0);
      addRoad(num, num, num, -ROAD_CURVE_EASY,  height/2);
      addRoad(num, num, num,  0,                0);
    }

    function addSCurves() {
      addRoad(ROAD_LENGTH_MEDIUM, ROAD_LENGTH_MEDIUM, ROAD_LENGTH_MEDIUM,  -ROAD_CURVE_EASY,    ROAD_HILL_NONE);
      addRoad(ROAD_LENGTH_MEDIUM, ROAD_LENGTH_MEDIUM, ROAD_LENGTH_MEDIUM,   ROAD_CURVE_MEDIUM,  ROAD_HILL_MEDIUM);
      addRoad(ROAD_LENGTH_MEDIUM, ROAD_LENGTH_MEDIUM, ROAD_LENGTH_MEDIUM,   ROAD_CURVE_EASY,   -ROAD_HILL_LOW);
      addRoad(ROAD_LENGTH_MEDIUM, ROAD_LENGTH_MEDIUM, ROAD_LENGTH_MEDIUM,  -ROAD_CURVE_EASY,    ROAD_HILL_MEDIUM);
      addRoad(ROAD_LENGTH_MEDIUM, ROAD_LENGTH_MEDIUM, ROAD_LENGTH_MEDIUM,  -ROAD_CURVE_MEDIUM, -ROAD_HILL_MEDIUM);
    }

    function addBumps() {
      addRoad(10, 10, 10, 0,  5);
      addRoad(10, 10, 10, 0, -2);
      addRoad(10, 10, 10, 0, -5);
      addRoad(10, 10, 10, 0,  8);
      addRoad(10, 10, 10, 0,  5);
      addRoad(10, 10, 10, 0, -7);
      addRoad(10, 10, 10, 0,  5);
      addRoad(10, 10, 10, 0, -2);
    }

    function addDownhillToEnd(num) {
      num = num || 200;
      addRoad(num, num, num, -ROAD_CURVE_EASY, -lastY()/segmentLength);
    }

function makeRoad1 () {
      addStraight(ROAD_LENGTH_SHORT);
      addLowRollingHills();
      addSCurves();
      addCurve(ROAD_LENGTH_MEDIUM, ROAD_CURVE_MEDIUM, ROAD_HILL_LOW);
      addBumps();
      addLowRollingHills();
      addCurve(ROAD_LENGTH_LONG*2, ROAD_CURVE_MEDIUM, ROAD_HILL_MEDIUM);
      addStraight();
      addHill(ROAD_LENGTH_MEDIUM, ROAD_HILL_HIGH);
      addSCurves();
      addCurve(ROAD_LENGTH_LONG, -ROAD_CURVE_MEDIUM, ROAD_HILL_NONE);
      addHill(ROAD_LENGTH_LONG, ROAD_HILL_HIGH);
      addCurve(ROAD_LENGTH_LONG, ROAD_CURVE_MEDIUM, -ROAD_HILL_LOW);
      addBumps();
      addHill(ROAD_LENGTH_LONG, -ROAD_HILL_MEDIUM);
      addStraight();
      addSCurves();
      addDownhillToEnd();

	totalLaps = 2;
}

function makeRoad2 () {
      addStraight(ROAD_LENGTH_LONG);
      addBumps();
      addStraight(ROAD_LENGTH_LONG);
		addCurve(0,-ROAD_CURVE_MEDIUM);
		addCurve(0,-ROAD_CURVE_MEDIUM);
      addHill();
		addCurve(0,-ROAD_CURVE_MEDIUM);
		addCurve(0,-ROAD_CURVE_MEDIUM);
      addStraight(ROAD_LENGTH_LONG);
      addBumps();
      addStraight(ROAD_LENGTH_LONG);
		addCurve(0,-ROAD_CURVE_MEDIUM);
		addCurve(0,-ROAD_CURVE_MEDIUM);
      addDownhillToEnd();
	totalLaps = 4;
}

    function resetRoad(r) {
      segments = [];
if (r === 0) {
makeRoad1();
}else if (r===1){
	makeRoad2();
}else {
makeRoad1();
totalLaps = 1;
}

      resetSprites();
      resetCars();

      segments[findSegment(playerZ).n + 2].c = COLORS.START;
      segments[findSegment(playerZ).n + 3].c = COLORS.START;
      for(var n = 0 ; n < rumbleLength ; n++)
        segments[segments.length-1-n].c = COLORS.FINISH;

      trackLength = segments.length * segmentLength;
    }

    function resetSprites() {
      var i;

	for (i = 0; i < segments.length; i += round(segments.length/(20 * details))) {
		addSprite((i + segments.length + Util_randomInt(-5, 5)) % segments.length, Util_randomChoice(SPRITES.OBJECTS), Util_randomChoice([1,-1]) * (1 + Math.random() * 2));
	}

    }

    function resetCars() {
      cars = [];
      var n, car, segment, offset, z, sprite, speed;
      for (var n = 0 ; n < totalCars ; n++) {
        offset = Math.random() * Util_randomChoice([-0.8, 0.8]);
        z      = floor(Math.random() * segments.length) * segmentLength;
        sprite = Util_randomChoice(SPRITES.CARS);
        speed  = maxSpeed/4 + Math.random() * maxSpeed/2;
        car = { o: offset, z: z, sprite: sprite, speed: speed };
        segment = findSegment(car.z);
        segment.cars.push(car);
        cars.push(car);
      }
    }

    //=========================================================================
    // THE GAME LOOP
    //=========================================================================


//=========================================================================
// GAME LOOP helpers
//=========================================================================



  //---------------------------------------------------------------------------

   function setKeyListener (keys) {
    var onkey = function(keyCode, mode) {
      var n, k;
      for(n = 0 ; n < keys.length ; n++) {
        k = keys[n];
        if (k.k == keyCode) {
          if (k.m == mode) {
            k.a();
          }
        }
      }
    };
    document.onkeydown = function(ev) { onkey(ev.keyCode, 'd'); };
    document.onkeyup = function(ev) { onkey(ev.keyCode, 'u');   };
  }

function setMobileListeners () {
	var accelerate = false, decelerate = false;
	window.ontouchstart = function (e) {
		var touch = e.changedTouches[0], id = touch.identifier + ''; //id could be 0, turn it into a string to make it truthy
		if (touch.pageX * 2 < document.documentElement.clientWidth) {
			decelerate = id;
		} else {
			accelerate = id;
		}
		keyFaster = !!accelerate;
		keySlower = !!decelerate
	};
	window.ontouchend = window.ontouchcancel = function (e) {
		var id = e.changedTouches[0].identifier + '';
		if (decelerate === id) {
			decelerate = false;
		}
		if (accelerate === id) {
			accelerate = false;
		}
		keyFaster = !!accelerate;
		keySlower = !!decelerate
	};

	window.ondeviceorientation = function (e) {
		keyLeft = false;
		keyRight = false;
		if (e.beta <= -5) {
			keyLeft = true;
		} else if (e.beta >= 5) {
			keyRight = true;
		}
	};
}

function init (style, car, road) {
setColorsSprites(style, car);
        background = makeBackground();
canvas.style.backgroundColor = COLORS.SKY;
        canvas.width  = width;
        canvas.height = height;
        cameraDepth            = 1 / Math.tan((fieldOfView/2) * Math.PI/180);
        playerZ                = (cameraHeight * cameraDepth);
        resolution             = height/320//480;

        resetRoad(road);
      

		resize();
		window.onresize = resize;
      setKeyListener([
        { k: 37, m: 'd', a: function() { keyLeft   = true;  } },
        { k: 39, m: 'd', a: function() { keyRight  = true;  } },
        { k: 38, m: 'd', a: function() { keyFaster = true;  } },
        { k: 40, m: 'd', a: function() { keySlower = true;  } },
        { k: 37, m: 'u', a: function() { keyLeft   = false; } },
        { k: 39, m: 'u', a: function() { keyRight  = false; } },
        { k: 38, m: 'u', a: function() { keyFaster = false; } },
        { k: 40, m: 'u', a: function() { keySlower = false; } }
      ]);
setMobileListeners();

      var now    = null,
          last   = Util_timestamp(),
          dt     = 0,
          gdt    = 0;

      function frame() {
        now = Util_timestamp();
        dt  = Math.min(1, (now - last) / 1000); // using requestAnimationFrame have to be able to handle large delta's caused when it 'hibernates' in a background or non-visible tab
        gdt = gdt + dt;
        while (gdt > step) {
          gdt = gdt - step;
			if (update(step)) {
	        render();
			playSound(-1);
			//ctx.font = '12px monospace'; already in render()
			//ctx.fillStyle = '#000';
			ctx.fillText(updateRecord(getKey(style, car, road), formatTime(currentTime)) ? 'New record!' : 'You did it!', width / 2 - 10, 30);
			setTimeout(function () {
				location.reload(false);
			}, 3000);
				return;
			}
        }
        render();
        last = now;
        requestAnimationFrame(frame);
      }
      frame(); // lets get this party started
}

function selection () {
var what={s: 0, c: 0, r: 0}, loadingDone, callback;

//this may take a while, so start it immediately
loadImages([getCarImg(0), getCarImg(0, 1), getCarImg(1), getCarImg(1, 1), getCarImg(2), getCarImg(2, 1), getCarImg(3), getCarImg(3, 1), getTree()], function (images) {
	sprites    = makeSprites(images);
	callback && callback();
	loadingDone = 1;
});

var recordElement = $('t');
var inputs = document.getElementsByTagName('input'), i;
for (i = 0; i < inputs.length; i++) {
	inputs[i].onchange = function () {
		what[this.name] = +this.value;
		showRecord();
	};
}
function showRecord () {
	recordElement.textContent = getRecord(getKey(what.s, what.c, what.r)) || '—';
}
$('g').onclick = function () {
	$('i').style.display = 'none';
	callback = function () {
		init(what.s, what.c, what.r);
	};
	loadingDone && callback();
};
showRecord();
}

selection();

})(window, localStorage, Math, document, setTimeout, Math.round, Math.floor);
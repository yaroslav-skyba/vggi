import { Model } from './Model.js';
import { mat4LookAt, mat4Multiply, mat4Perspective, mat4RotationX,
  mat4RotationY, mat4Translation, mat4TransformPoint } from './math.js';

const canvas=document.querySelector('#glCanvas');
const gl=canvas.getContext('webgl',{antialias:true});
if(!gl) throw new Error('WebGL is unavailable');
const $=id=>document.getElementById(id);

const vertexSource=`
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec4 aTangent;
attribute vec2 aTexCoord;
uniform mat4 uModelView;
uniform mat4 uProjection;
varying vec3 vPositionView;
varying vec3 vNormalView;
varying vec3 vTangentView;
varying float vHandedness;
varying vec2 vTexCoord;
void main(){
  vec4 p=uModelView*vec4(aPosition,1.0);
  vPositionView=p.xyz;
  vNormalView=normalize(mat3(uModelView)*aNormal);
  vTangentView=normalize(mat3(uModelView)*aTangent.xyz);
  vHandedness=aTangent.w;
  vTexCoord=aTexCoord;
  gl_Position=uProjection*p;
}`;

const fragmentSource=`
precision highp float;
uniform vec3 uLightPositionView;
uniform sampler2D uDiffuseMap;
uniform sampler2D uSpecularMap;
uniform sampler2D uNormalMap;
uniform bool uUseDiffuse;
uniform bool uUseSpecular;
uniform bool uUseNormal;
varying vec3 vPositionView;
varying vec3 vNormalView;
varying vec3 vTangentView;
varying float vHandedness;
varying vec2 vTexCoord;
void main(){
  // Gram-Schmidt with tangent priority: preserve T, adjust N.
  vec3 T=normalize(vTangentView);
  vec3 N0=normalize(vNormalView);
  vec3 N=normalize(N0-dot(N0,T)*T);
  vec3 B=cross(N,T)*(vHandedness<0.0?-1.0:1.0);
  mat3 TBN=mat3(T,B,N);

  vec3 sampledNormal=texture2D(uNormalMap,vTexCoord).rgb*2.0-1.0;
  vec3 finalNormal=uUseNormal ? normalize(TBN*normalize(sampledNormal)) : N;
  vec3 diffuseColor=uUseDiffuse ? texture2D(uDiffuseMap,vTexCoord).rgb : vec3(0.12,0.70,0.82);
  vec3 specularColor=uUseSpecular ? texture2D(uSpecularMap,vTexCoord).rgb : vec3(1.0);
  vec3 L=normalize(uLightPositionView-vPositionView);
  vec3 V=normalize(-vPositionView);
  float lambert=max(dot(finalNormal,L),0.0);
  vec3 ambient=0.16*diffuseColor;
  vec3 diffuse=0.78*lambert*diffuseColor;
  float shininess=0.0;
  if(lambert>0.0){
    vec3 R=reflect(-L,finalNormal);
    shininess=pow(max(dot(R,V),0.0),36.0);
  }
  vec3 specular=0.62*shininess*specularColor;
  gl_FragColor=vec4(ambient+diffuse+specular,1.0);
}`;
const lightVS=`
attribute vec3 aPosition;
uniform mat4 uModelView;
uniform mat4 uProjection;
uniform vec3 uLightPosition;
void main(){gl_Position=uProjection*uModelView*vec4(aPosition*0.16+uLightPosition,1.0);}`;
const lightFS=`precision mediump float;
void main(){gl_FragColor=vec4(1.0,0.82,0.18,1.0);}`;

function shader(type,source){
  const sh=gl.createShader(type);
  gl.shaderSource(sh,source);gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(sh));
  return sh;
}
function program(v,f){
  const p=gl.createProgram(),vs=shader(gl.VERTEX_SHADER,v),fs=shader(gl.FRAGMENT_SHADER,f);
  gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
  gl.deleteShader(vs);gl.deleteShader(fs);return p;
}
function info(p,attrs,unis){
  return {program:p,attributes:Object.fromEntries(attrs.map(([k,v])=>[k,gl.getAttribLocation(p,v)])),
    uniforms:Object.fromEntries(unis.map(k=>[k,gl.getUniformLocation(p,k)]))};
}
const surface=info(program(vertexSource,fragmentSource),
  [['position','aPosition'],['normal','aNormal'],['tangent','aTangent'],['texCoord','aTexCoord']],
  ['uModelView','uProjection','uLightPositionView','uDiffuseMap','uSpecularMap','uNormalMap','uUseDiffuse','uUseSpecular','uUseNormal']);
const light=info(program(lightVS,lightFS),[['position','aPosition']],['uModelView','uProjection','uLightPosition']);

let loaded=0;
function loadTexture(filename,unit,fallback){
  const texture=gl.createTexture();
  gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(fallback));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  const image=new Image();
  image.onload=()=>{
    gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    loaded++;
    $('textureStatus').textContent=loaded===3?'All three textures loaded':`Loaded ${loaded} of 3 textures`;
  };
  image.onerror=()=>{
    $('textureStatus').textContent=`Texture missing: ${filename} (check /textures)`;
    console.error(`Failed to load ${filename}`);
  };
  image.src=`./textures/${filename}`;
  return texture;
}
const textures=[
  loadTexture('diffuse.png',0,[31,179,190,255]),
  loadTexture('specular.png',1,[190,190,190,255]),
  loadTexture('normal.png',2,[128,128,255,255])
];

function createLightSphere(){
  const p=[],indices=[],LAT=12,LON=18;
  for(let i=0;i<=LAT;i++)for(let j=0;j<=LON;j++){
    const t=Math.PI*i/LAT,f=Math.PI*2*j/LON;
    p.push(Math.sin(t)*Math.cos(f),Math.sin(t)*Math.sin(f),Math.cos(t));
  }
  for(let i=0;i<LAT;i++)for(let j=0;j<LON;j++){
    const a=i*(LON+1)+j,b=a+LON+1;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  const v=gl.createBuffer(),e=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,v);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(p),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,e);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
  return {v,e,count:indices.length};
}
const sphere=createLightSphere();
function drawLight(modelView,projection,lightPosition){
  gl.useProgram(light.program);
  gl.bindBuffer(gl.ARRAY_BUFFER,sphere.v);
  gl.enableVertexAttribArray(light.attributes.position);
  gl.vertexAttribPointer(light.attributes.position,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,sphere.e);
  gl.uniformMatrix4fv(light.uniforms.uModelView,false,modelView);
  gl.uniformMatrix4fv(light.uniforms.uProjection,false,projection);
  gl.uniform3fv(light.uniforms.uLightPosition,lightPosition);
  gl.drawElements(gl.TRIANGLES,sphere.count,gl.UNSIGNED_SHORT,0);
}

let model;
function rebuild(){
  const U=+$('uSlider').value,V=+$('vSlider').value,rotation=+$('angleSlider').value;
  $('uValue').textContent=U;
  $('vValue').textContent=V;
  $('angleValue').textContent=`${rotation}°`;
  if(model) model.dispose();
  model=new Model(gl,{L:4,T:2,B:0.5,uSegments:U,vSegments:V,uvRotation:rotation});
}
['uSlider','vSlider','angleSlider'].forEach(id=>$(id).addEventListener('input',rebuild));
rebuild();
let rotationX=-0.55,rotationY=-0.75,cameraDistance=8.5;
let dragging=false,previousX=0,previousY=0;
canvas.addEventListener('mousedown',e=>{dragging=true;previousX=e.clientX;previousY=e.clientY;});
window.addEventListener('mouseup',()=>dragging=false);
window.addEventListener('mousemove',e=>{
  if(!dragging)return;
  rotationY+=(e.clientX-previousX)*0.01;
  rotationX+=(e.clientY-previousY)*0.01;
  previousX=e.clientX;previousY=e.clientY;
});
canvas.addEventListener('wheel',e=>{e.preventDefault();cameraDistance=Math.max(5.5,Math.min(14,cameraDistance+e.deltaY*0.01));},{passive:false});

function render(ms){
  const dpr=window.devicePixelRatio||1;
  const w=Math.floor(canvas.clientWidth*dpr),h=Math.floor(canvas.clientHeight*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
  gl.clearColor(0.025,0.040,0.045,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const projection=mat4Perspective(Math.PI/4,w/h,0.1,100);
  const view=mat4LookAt([0,0,cameraDistance],[0,0,0],[0,1,0]);
  const rotation=mat4Multiply(mat4RotationY(rotationY),mat4RotationX(rotationX));
  const modelMatrix=mat4Multiply(rotation,mat4Translation(-2,0,-0.65));
  const modelView=mat4Multiply(view,modelMatrix);
  const seconds=ms*0.00055;
  const lightModel=[2+4.6*Math.cos(seconds),4.6*Math.sin(seconds),2.5];
  const lightView=mat4TransformPoint(modelView,lightModel);
  gl.useProgram(surface.program);
  const u=surface.uniforms;
  gl.uniformMatrix4fv(u.uModelView,false,modelView);
  gl.uniformMatrix4fv(u.uProjection,false,projection);
  gl.uniform3fv(u.uLightPositionView,lightView);
  textures.forEach((t,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t);});
  gl.uniform1i(u.uDiffuseMap,0);gl.uniform1i(u.uSpecularMap,1);gl.uniform1i(u.uNormalMap,2);
  gl.uniform1i(u.uUseDiffuse,$('diffuseEnabled').checked?1:0);
  gl.uniform1i(u.uUseSpecular,$('specularEnabled').checked?1:0);
  gl.uniform1i(u.uUseNormal,$('normalEnabled').checked?1:0);
  model.draw(surface);
  drawLight(modelView,projection,lightModel);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

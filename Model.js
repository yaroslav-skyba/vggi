// Conical surface with a Cartesian folium directrix (PA2, variant 15).
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const length = a => Math.hypot(...a);
const normalized = a => { const l = length(a); return l > 1e-10 ? a.map(x => x/l) : [0, 0, 0]; };
const angle = (a, b) => {
  const l = length(a)*length(b);
  return l > 1e-12 ? Math.acos(Math.max(-1, Math.min(1, dot(a,b)/l))) : 0;
};

export class Model {
  constructor(gl, { L=4, T=2, B=0.5, uSegments=32, vSegments=48, uvRotation=0 }={}) {
    this.gl = gl;
    this.L=L; this.T=T; this.B=B;
    this.uSegments=uSegments; this.vSegments=vSegments;
    this.uvRotation=uvRotation;
    this.buildGeometry();
  }

  directrixPoint(v, side) {
    const y = side*2.5426*this.B*v*Math.sqrt((1-v)/(1/3+v));
    return [0, y, this.T*v];
  }

  surfacePoint(u, v, side) {
    const d = this.directrixPoint(v, side);
    const apex = [this.L, 0, this.T/Math.sqrt(3)];
    return d.map((x,i) => (1-u)*x+u*apex[i]);
  }

  buildGeometry() {
    const positions=[], texCoords=[], indices=[];
    const U=this.uSegments, V=this.vSegments;
    const uvAngle=this.uvRotation*Math.PI/180;
    const c=Math.cos(uvAngle), s=Math.sin(uvAngle);
    // UV rotation is performed BEFORE computing triangle tangents.
    // Therefore the tangent frame rotates together with the texture layout.
    const tex = (u,v) => {
      const x=v-0.5, y=u-0.5;
      return [0.5+c*x-s*y, 0.5+s*x+c*y];
    };
    const vertex=(p,uv) => {
      const index=positions.length/3;
      positions.push(...p); texCoords.push(...uv);
      return index;
    };
    for (const side of [1,-1]) {
      const first=positions.length/3;
      const idx=(i,j)=>first+i*(V+1)+j;
      for (let i=0;i<U;i++) {
        const u=i/U;
        for(let j=0;j<=V;j++) {
          const q=j/V;
          vertex(this.surfacePoint(u,-0.3+1.3*q,side),tex(u,q));
        }
      }
      // One apex per last-row segment: avoids undefined UV directions
      // from a single apex shared by every triangle in the fan.
      for(let j=0;j<V;j++) {
        const a=idx(U-1,j), b=idx(U-1,j+1);
        const p=vertex(this.surfacePoint(1,-0.3,side),tex(1,(j+0.5)/V));
        if(side>0) indices.push(a,b,p);
        else indices.push(a,p,b);
      }
      for(let i=0;i<U-1;i++) for(let j=0;j<V;j++) {
        const a=idx(i,j),b=idx(i+1,j),c=idx(i+1,j+1),d=idx(i,j+1);
        if(side>0) indices.push(a,c,b,a,d,c);
        else indices.push(a,b,c,a,c,d);
      }
    }

    const nVertices=positions.length/3;
    const normals=new Float64Array(nVertices*3);
    const tangents=new Float64Array(nVertices*3);
    const bitangents=new Float64Array(nVertices*3);
    let skipped=0;
    // Tangents follow the actual 3D triangles AND the corresponding UV triangles.
    for(let k=0;k<indices.length;k+=3) {
      const ids=indices.slice(k,k+3);
      const p=ids.map(i=>positions.slice(3*i,3*i+3));
      const uv=ids.map(i=>texCoords.slice(2*i,2*i+2));
      const e1=sub(p[1],p[0]), e2=sub(p[2],p[0]);
      const face=cross(e1,e2), faceLength=length(face);
      if(faceLength<1e-10) { skipped++; continue; }
      const N=face.map(x=>x/faceLength);
      const du1=uv[1][0]-uv[0][0], dv1=uv[1][1]-uv[0][1];
      const du2=uv[2][0]-uv[0][0], dv2=uv[2][1]-uv[0][1];
      const determinant=du1*dv2-du2*dv1;
      const validUV=Math.abs(determinant)>1e-12;
      const tangent=validUV ? e1.map((x,i)=>(x*dv2-e2[i]*dv1)/determinant) : [0,0,0];
      const bitangent=validUV ? e1.map((x,i)=>(e2[i]*du1-x*du2)/determinant) : [0,0,0];
      const weights=[angle(e1,e2),angle(sub(p[2],p[1]),sub(p[0],p[1])),angle(sub(p[0],p[2]),sub(p[1],p[2]))];
      ids.forEach((id,corner)=>{
        const w=weights[corner];
        for(let z=0;z<3;z++) {
          normals[3*id+z]+=N[z]*w;
          tangents[3*id+z]+=tangent[z]*w;
          bitangents[3*id+z]+=bitangent[z]*w;
        }
      });
    }
    const normalData=[], tangentData=[];
    for(let i=0;i<nVertices;i++) {
      let N=normalized(Array.from(normals.slice(i*3,i*3+3)));
      if(length(N)<0.5) N=[0,0,1];
      let T=Array.from(tangents.slice(i*3,i*3+3));
      if(length(T)<1e-9) {
        T=normalized(cross([0,0,1],N));
        if(length(T)<0.5) T=[1,0,0];
      }
      T=normalized(T);
      // Gram-Schmidt, variant 15: T priority (N is adjusted in fragment shader).
      const adjustedN=normalized(sub(N,T.map(t=>t*dot(N,T))));
      const B=Array.from(bitangents.slice(i*3,i*3+3));
      const handedness=dot(cross(adjustedN,T),B)<0 ? -1 : 1;
      normalData.push(...N);
      tangentData.push(...T,handedness);
    }
    this.buffers={
      position:this.arrayBuffer(new Float32Array(positions)),
      normal:this.arrayBuffer(new Float32Array(normalData)),
      tangent:this.arrayBuffer(new Float32Array(tangentData)),
      texCoord:this.arrayBuffer(new Float32Array(texCoords))
    };
    this.indexBuffer=this.elementBuffer(new Uint16Array(indices));
    this.indexCount=indices.length;
    this.stats={vertices:nVertices,triangles:indices.length/3,skipped};
  }

  arrayBuffer(data) { return this.buffer(this.gl.ARRAY_BUFFER,data); }
  elementBuffer(data) { return this.buffer(this.gl.ELEMENT_ARRAY_BUFFER,data); }
  buffer(target,data) {
    const gl=this.gl,b=gl.createBuffer();
    gl.bindBuffer(target,b); gl.bufferData(target,data,gl.STATIC_DRAW);
    return b;
  }
  draw(info) {
    const gl=this.gl;
    for(const [key,size] of [['position',3],['normal',3],['tangent',4],['texCoord',2]]) {
      const loc=info.attributes[key];
      if(loc<0) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[key]);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indexBuffer);
    gl.drawElements(gl.TRIANGLES,this.indexCount,gl.UNSIGNED_SHORT,0);
  }
  dispose() {
    Object.values(this.buffers).forEach(b=>this.gl.deleteBuffer(b));
    this.gl.deleteBuffer(this.indexBuffer);
  }
}

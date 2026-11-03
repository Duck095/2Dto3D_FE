import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import './style.css';

const parts = [
  { id: 'shell', code: 'AX-01 / 01', name: 'Outer shell', material: 'Matte PETG', color: '#d9e5e1', weight: '18.4 g' },
  { id: 'core', code: 'AX-01 / 02', name: 'Drive core', material: 'Brushed aluminum', color: '#c9a050', weight: '9.2 g' },
  { id: 'ring', code: 'AX-01 / 03', name: 'Locking ring', material: 'Teal nylon', color: '#0f766e', weight: '6.8 g' },
];

function PartAssembly({ active, exploded }) {
  const group = useRef();
  return (
    <group ref={group} rotation={[0.08, -0.42, -0.05]}>
      <mesh position={[0, exploded ? 0.42 : 0, 0]} castShadow>
        <cylinderGeometry args={[1.02, 0.9, 0.46, 12, 1]} />
        <meshStandardMaterial color={active === 'shell' ? '#9ad5c9' : '#d9e5e1'} roughness={0.34} metalness={0.12} />
      </mesh>
      <mesh position={[0, exploded ? -0.18 : 0, 0]} castShadow>
        <cylinderGeometry args={[0.58, 0.58, 1.05, 12, 1]} />
        <meshStandardMaterial color={active === 'core' ? '#edcb83' : '#c9a050'} roughness={0.27} metalness={0.72} />
      </mesh>
      <mesh position={[0, exploded ? -0.78 : -0.08, 0]} castShadow>
        <torusGeometry args={[0.75, 0.13, 8, 12]} />
        <meshStandardMaterial color={active === 'ring' ? '#3db4a3' : '#0f766e'} roughness={0.32} metalness={0.28} />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2;
        return <mesh key={index} position={[Math.cos(angle) * 0.89, exploded ? 0.45 : 0.02, Math.sin(angle) * 0.89]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.1, 8]} />
          <meshStandardMaterial color="#c9a050" roughness={0.27} metalness={0.72} />
        </mesh>;
      })}
      <mesh position={[0, -0.01, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 1.42, 12, 1, true]} />
        <meshStandardMaterial color="#7b8582" metalness={0.78} roughness={0.24} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function App() {
  const [active, setActive] = useState('shell');
  const [exploded, setExploded] = useState(true);
  const selected = parts.find((part) => part.id === active);
  return <main className="shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Morphia 3D home"><span className="brand-mark">M</span><span>Morphia <b>3D</b></span></a>
      <nav aria-label="Primary"><a href="#catalog">Catalog</a><a href="#studio">3D Studio</a><a href="#maker">For makers</a></nav>
      <button className="account" type="button">My workspace <span>↗</span></button>
    </header>

    <section className="intro" id="top">
      <div>
        <div className="crumb">Catalog <span>/</span> Mechanical parts <span>/</span> AX series</div>
        <h1>Parts you can <em>understand.</em></h1>
        <p className="lead">Inspect every component before it reaches your workbench.</p>
      </div>
      <div className="model-code"><span className="status-dot" /> MODEL AX-01 <i>REV 04</i></div>
    </section>

    <section className="workspace" id="studio" aria-label="Interactive part viewer">
      <div className="viewer">
        <div className="viewer-head"><div><span className="eyebrow">ASSEMBLY VIEW</span><span className="view-subtitle">Drag to inspect · select a component</span></div><span className="view-index">01 <b>/</b> 03</span></div>
        <div className="scene">
          <div className="scene-grid" aria-hidden="true" />
          <Canvas camera={{ position: [3.5, 2.65, 4.25], fov: 36 }} dpr={[1, 1.5]} shadows>
            <color attach="background" args={['#eef2ef']} />
            <ambientLight intensity={0.78} />
            <directionalLight position={[4, 6, 5]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
            <PartAssembly active={active} exploded={exploded} />
            <ContactShadows position={[0, -1.2, 0]} opacity={0.3} scale={5} blur={2.5} far={3} />
            <Environment preset="studio" />
            <OrbitControls makeDefault enablePan={false} minDistance={3.5} maxDistance={7} />
          </Canvas>
          <button className={`hotspot hotspot-one ${active === 'shell' ? 'is-active' : ''}`} onClick={() => setActive('shell')} aria-label="Select outer shell">01</button>
          <button className={`hotspot hotspot-two ${active === 'core' ? 'is-active' : ''}`} onClick={() => setActive('core')} aria-label="Select drive core">02</button>
          <button className={`hotspot hotspot-three ${active === 'ring' ? 'is-active' : ''}`} onClick={() => setActive('ring')} aria-label="Select locking ring">03</button>
          <div className="orbit-hint"><span>↔</span> ORBIT TO EXPLORE</div>
          <button className="explode-toggle" type="button" onClick={() => setExploded((value) => !value)} aria-pressed={exploded}>
            <span className="explode-icon">{exploded ? '⊖' : '⊕'}</span>{exploded ? 'ASSEMBLED VIEW' : 'EXPLODED VIEW'}
          </button>
        </div>
        <div className="viewer-foot"><span><i className="live-dot" /> 3D MODEL LOADED</span><span>MM · GRAMS</span><span>WEBGL / RENDER 01</span></div>
      </div>

      <aside className="details" aria-label="Part details">
        <div className="details-header"><span className="eyebrow">COMPONENTS</span><span className="count">03 PARTS</span></div>
        <div className="part-list">
          {parts.map((part, index) => <button className={`part-row ${active === part.id ? 'selected' : ''}`} onClick={() => setActive(part.id)} key={part.id} aria-pressed={active === part.id}>
            <span className="part-number">0{index + 1}</span><span className="part-swatch" style={{ '--part-color': part.color }} />
            <span className="part-label"><b>{part.name}</b><small>{part.code}</small></span><span className="part-chevron">↗</span>
          </button>)}
        </div>
        <div className="selected-part">
          <span className="eyebrow">SELECTED COMPONENT</span>
          <h2>{selected.name}</h2>
          <p>{selected.material} <span className="divider">·</span> {selected.weight}</p>
          <div className="spec-rule" />
          <dl><div><dt>Part number</dt><dd>{selected.code}</dd></div><div><dt>Fit system</dt><dd>AX modular</dd></div><div><dt>Print profile</dt><dd>0.20 mm · 4 walls</dd></div></dl>
        </div>
        <div className="details-bottom"><div className="availability"><span className="live-dot" /><span>Ready to make</span></div><button type="button" className="download">Download part <span>↓</span></button><small>STL · 2.4 MB <i>Free model</i></small></div>
      </aside>
    </section>

    <footer className="page-foot"><span>Made for curious hands.</span><span>Prototype concept · Interaction and data are illustrative.</span><a id="maker" href="#top">Explore the collection <b>↗</b></a></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);

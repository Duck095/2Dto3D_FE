import React from 'react';
import { createRoot } from 'react-dom/client';
import { CircleButtons } from '@designcodeio/threeui/components/CircleButtons';
import '@designcodeio/threeui/style.css';
import './threeui.css';

function App() {
  return <main className="threeui-page">
    <a href="/" className="threeui-back">← Back to AX-01 demo</a>
    <section className="threeui-card">
      <div className="threeui-copy">
        <p className="threeui-eyebrow">THREEUI COMMUNITY · 1.2.0</p>
        <h1>Small controls.<br />Clear intent.</h1>
        <p>Isolated package check: real ThreeUI circle controls, imported through the public component subpath and paired with a 2Dto3D part-selection use case.</p>
        <a className="threeui-link" href="https://github.com/MengTo/threeui" target="_blank" rel="noreferrer">View upstream package ↗</a>
      </div>
      <div className="threeui-actions" aria-label="ThreeUI component examples">
        <div className="threeui-action"><CircleButtons className="threeui-control" variant="plus" mode="dark" ariaLabel="Add a custom part" onClick={() => {}} /><span>Add part</span></div>
        <div className="threeui-action"><CircleButtons className="threeui-control" variant="play" mode="dark" ariaLabel="Preview the selected part" onClick={() => {}} /><span>Preview</span></div>
        <div className="threeui-action"><CircleButtons className="threeui-control" variant="mail" mode="dark" ariaLabel="Share the build" onClick={() => {}} /><span>Share</span></div>
      </div>
    </section>
    <p className="threeui-note">The controls render and expose accessible button labels. This standalone check does not add ThreeUI to the production app.</p>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);

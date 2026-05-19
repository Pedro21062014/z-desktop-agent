import React from 'react';

export default function TitleBar({ onToggleSidebar }) {
  const handleWindowAction = async (action) => {
    await window.electronAPI.windowAction(action);
  };

  return (
    <div className="titlebar">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button className="titlebar-button titlebar-close" onClick={() => handleWindowAction('close')} />
          <button className="titlebar-button titlebar-minimize" onClick={() => handleWindowAction('minimize')} />
          <button className="titlebar-button titlebar-maximize" onClick={() => handleWindowAction('maximize')} />
        </div>
        <button
          onClick={onToggleSidebar}
          className="text-zinc-500 hover:text-zinc-300 transition-colors ml-2"
          title="Toggle sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <span className="text-zinc-500 text-xs font-medium tracking-wider ml-2">
          Z DESKTOP AGENT
        </span>
      </div>
      <div className="text-zinc-600 text-xs">
        v1.0.1
      </div>
    </div>
  );
}

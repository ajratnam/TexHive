import React from 'react';

function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-header-color text-text-color">
      <div className="flex items-center">
        <button id="hamburger-btn" className="mr-4 focus:outline-none">
          <svg className="w-6 h-6 fill-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold">TexHive</h1>
      </div>
      <div className="flex items-center space-x-4">
        <button id="compile-btn" className="px-4 py-2 bg-blue-500 text-white rounded">
          Compile &amp; Preview
        </button>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input type="checkbox" id="realtime-toggle" className="hidden" />
          <div className="w-10 h-5 bg-gray-600 rounded-full relative transition-all duration-300">
            <div id="toggle-indicator" className="w-4 h-4 bg-white rounded-full shadow absolute top-0.5 left-0.5 transition-all duration-300"></div>
          </div>
          <span>Realtime</span>
        </label>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input type="checkbox" id="ignore-warnings" className="hidden" />
          <div className="w-10 h-5 bg-gray-600 rounded-full relative transition-all duration-300">
            <div id="ignore-warnings-indicator" className="w-4 h-4 bg-white rounded-full shadow absolute top-0.5 left-0.5 transition-all duration-300"></div>
          </div>
          <span>Ignore Warnings</span>
        </label>
        <select id="theme-selector">
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="solarized">Solarized</option>
          <option value="dracula">Dracula</option>
          <option value="monokai">Monokai</option>
          <option value="nord">Nord</option>
          <option value="gruvbox">Gruvbox</option>
          <option value="cobalt">Cobalt</option>
        </select>
      </div>
    </header>
  );
}

export default Header;

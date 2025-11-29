import React from 'react';
import { InputDemo } from './components/InputDemo';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 relative flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 sticky top-0 z-10 shadow-md">
        <h1 className="text-xl font-bold">Keyboard Adaptive Demo</h1>
        <p className="text-xs opacity-80 mt-1">Scroll down to test bottom inputs</p>
      </header>

      {/* Warning/Instruction Banner */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 m-4 text-sm text-yellow-700">
        <p className="font-bold">Testing Instructions:</p>
        <p>1. Open Developer Tools (F12).</p>
        <p>2. Toggle Device Toolbar (Ctrl+Shift+M).</p>
        <p>3. Select a mobile device (e.g., iPhone 12).</p>
        <p>4. <strong>Important:</strong> This logic detects <code>resize</code> events. On a real desktop browser, the keyboard doesn't appear. On a real phone (especially Android H5), the viewport might resize (handled) or overlay (padding added).</p>
        <p className="mt-2">To simulate overlay (no resize) on desktop: just ensure the window height doesn't change when you focus.</p>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 pb-12">
        <div className="space-y-6">
          <InputDemo 
            label="Top Input" 
            placeholder="Focus me..." 
            description="This input is already safe at the top."
          />

          <div className="h-32 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400">
            Spacer Content
          </div>

          <InputDemo 
            label="Middle Input" 
            placeholder="Focus me..." 
            description="Might need adjustment on small screens."
          />

          {/* Large spacer to force scrolling */}
          <div className="space-y-4">
             {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-400 text-sm">
                  Scroll Content Block {i + 1}
                </div>
             ))}
          </div>

          <InputDemo 
            label="Bottom Input (Dangerous)" 
            placeholder="Focus me..." 
            description="This is the critical test case. It sits at the very bottom."
          />
           <InputDemo 
            label="Very Bottom Input" 
            placeholder="Focus me too..." 
            description="Testing rapid switching between bottom inputs."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t p-4 text-center text-xs text-slate-400">
        &copy; 2024 Adaptive Input Demo
      </footer>
    </div>
  );
};

export default App;
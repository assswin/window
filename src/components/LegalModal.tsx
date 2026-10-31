import React, { useState } from 'react';
import { X, Shield, FileText, Cookie, Check } from 'lucide-react';

export type LegalTab = 'terms' | 'privacy' | 'cookies';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LegalTab;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'terms'
}) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  // Sync active tab when initialTab changes
  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2.5">
            <Shield className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                Legal &amp; Privacy Information
              </h2>
              <p className="text-xs text-slate-400">
                WindowBuilder Fabrication Standards &amp; Policies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close legal modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-3 pt-2 gap-1.5 overflow-x-auto select-none">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex items-center space-x-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'terms'
                ? 'border-blue-500 text-white bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Terms &amp; Conditions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center space-x-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'border-blue-500 text-white bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy Policy</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cookies')}
            className={`flex items-center space-x-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'cookies'
                ? 'border-blue-500 text-white bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cookie className="w-3.5 h-3.5" />
            <span>Cookie Policy</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 text-xs text-slate-300 space-y-4 leading-relaxed font-sans">
          {/* TAB 1: TERMS AND CONDITIONS */}
          {activeTab === 'terms' && (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Effective Date: October 2026</span>
                <h3 className="text-sm font-bold text-white mt-1">1. Acceptance of Terms</h3>
                <p className="mt-1 text-slate-400">
                  By using or accessing WindowBuilder ("the Application"), you agree to be bound by these Terms and Conditions. If you disagree with any portion of these terms, do not use the Application.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  2. Fabrication &amp; Engineering Tolerance Notice
                </h4>
                <p className="text-slate-400 text-[11px]">
                  WindowBuilder provides automated mathematical cutting dimensions based on verified Indian and international aluminium extrusion standards (including 18×50 and 25×50 series). 
                </p>
                <p className="text-slate-400 text-[11px]">
                  <strong>Workshop Requirement:</strong> Aluminium profile die extrusions, wall thicknesses, interlock gasket heights, and roller clearances can vary by manufacturer (e.g. Jindal, Hindalco, local fabrications). Fabricators are required to verify sample prototype cuts before initiating full mass-production cutting. WindowBuilder is not liable for miscut raw aluminium extrusions or fabrication losses resulting from custom die differences.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">3. Intellectual Property &amp; User Ownership</h3>
                <p className="mt-1 text-slate-400">
                  The calculation algorithms, responsive 2D blueprint engine, and interface code belong to WindowBuilder. However, all window dimensions, job data, customer specifications, and exported PDF cutting sheets generated by you remain 100% your property.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">4. Permitted Commercial Use</h3>
                <p className="mt-1 text-slate-400">
                  Fabricators, contractors, installers, and estimation engineers are granted a royalty-free license to use WindowBuilder for calculating cutting sizes, generating customer quotations, creating fabrication sheets, and running daily workshop operations.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">5. Limitation of Liability</h3>
                <p className="mt-1 text-slate-400">
                  To the maximum extent permitted by applicable law, WindowBuilder and its developers provide this application on an "as-is" and "as-available" basis without warranties of any kind. Under no circumstances shall WindowBuilder be liable for indirect, incidental, or consequential damages resulting from calculation inputs or cutting operations.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: PRIVACY POLICY */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Privacy by Architecture</span>
                <h3 className="text-sm font-bold text-white mt-1">1. Offline &amp; Local-First Architecture</h3>
                <p className="mt-1 text-slate-400">
                  WindowBuilder is engineered from the ground up to respect your workshop privacy. All calculation operations, 2D blueprint projections, and unit conversions execute <strong>100% locally on your device</strong> inside your web browser.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-slate-300" />
                  What Data is Collected?
                </h4>
                <ul className="text-slate-400 text-[11px] space-y-1 list-disc list-inside">
                  <li><strong>Zero Project Data on Servers:</strong> We do NOT transmit, upload, or store your window dimensions, customer measurements, or job names to any external database or cloud server.</li>
                  <li><strong>Zero Tracking or Ads:</strong> We do NOT use third-party tracking pixels, marketing cookies, or advertisement networks.</li>
                  <li><strong>Local Storage Only:</strong> Saved calculation history is stored strictly in your browser's local storage (<code className="text-slate-300 font-mono">localStorage</code>) on your own device.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">2. WhatsApp Sharing &amp; PDF Exports</h3>
                <p className="mt-1 text-slate-400">
                  When you tap <strong>"WhatsApp"</strong>, the cutting sheet text is formatted locally and dispatched directly to your device's WhatsApp application. We never intercept, read, or log your WhatsApp messages. Similarly, <strong>"Save PDF"</strong> compiles the PDF cutting sheet in-memory on your device using client-side JavaScript without cloud processing.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">3. Data Retention &amp; User Control</h3>
                <p className="mt-1 text-slate-400">
                  You have absolute control over your data. You can delete individual saved calculations or use the "Clear All Saved Calculations" button in the History Drawer at any time to permanently remove all saved orders from your browser.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">4. Updates to this Policy</h3>
                <p className="mt-1 text-slate-400">
                  Any future updates to our privacy standards will be posted here. Continued use of WindowBuilder constitutes acceptance of any revised terms.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: COOKIE POLICY */}
          {activeTab === 'cookies' && (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Cookie &amp; Storage Transparency</span>
                <h3 className="text-sm font-bold text-white mt-1">1. How We Use Cookies &amp; Local Storage</h3>
                <p className="mt-1 text-slate-400">
                  Unlike traditional websites that use cookies to track user behavior across the web, WindowBuilder uses <strong>strictly functional browser storage</strong> solely to ensure your workshop tools work offline and remember your orders.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Storage Keys Utilized:
                </h4>

                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-white font-bold">windowbuilder_saved_calculations</span>
                    <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">Strictly Necessary</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Stores up to 50 saved window orders and cutting dimensions locally so you can reload them without retyping.
                  </p>
                </div>

                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-white font-bold">windowbuilder_cookie_consent</span>
                    <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">Essential Preference</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Remembers your consent choice so the cookie notice does not repeatedly appear on every session.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">2. Managing Cookie Preferences</h3>
                <p className="mt-1 text-slate-400">
                  Because our cookies and local storage are strictly functional and essential for saving calculations and maintaining your offline workshop state, disabling them may prevent you from saving calculation history. You can reset your cookie preferences at any time from the app footer.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono text-[11px]">
            L.S. INTERIORS v1.0 • Offline Ready
          </span>
          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition active:scale-95 cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};

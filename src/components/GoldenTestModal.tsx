import React, { useState, useEffect } from 'react';
import { GoldenTestSuite, TestCaseResult } from '../engine/tests';
import { X, CheckCircle2, XCircle, Play, ShieldCheck, RefreshCw } from 'lucide-react';

interface GoldenTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoldenTestModal: React.FC<GoldenTestModalProps> = ({ isOpen, onClose }) => {
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [passedCount, setPassedCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);

  const runTests = () => {
    setRunning(true);
    setTimeout(() => {
      const suite = GoldenTestSuite.runAllTests();
      setResults(suite.results);
      setPassedCount(suite.passedCount);
      setTotalCount(suite.totalCount);
      setRunning(false);
    }, 150);
  };

  useEffect(() => {
    if (isOpen) {
      runTests();
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
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
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Verification Tests</h2>
              <p className="text-xs text-slate-400">Deterministic calculation checks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Metric Bar */}
        <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-2xl font-bold font-mono text-white">
              {passedCount} / {totalCount}
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 block">
                {passedCount === totalCount ? 'All Tests Passing (100%)' : 'Failures Detected'}
              </span>
              <span className="text-[11px] text-slate-500">Fabrication standard validation</span>
            </div>
          </div>

          <button
            onClick={runTests}
            disabled={running}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95 disabled:opacity-50 border border-slate-700 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            <span>Re-run</span>
          </button>
        </div>

        {/* Test Cases List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5 font-mono text-xs">
          {results.map((res, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl border transition ${
                res.passed
                  ? 'bg-slate-950 border-slate-800'
                  : 'bg-red-950/30 border-red-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-2">
                  {res.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold text-slate-200">{res.name}</span>
                    <span className="text-[10px] block text-slate-500 mt-0.5 font-sans">
                      Category: {res.category}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded uppercase tracking-wider ${
                    res.passed
                      ? 'bg-slate-800 text-slate-300 border border-slate-700'
                      : 'bg-red-950 text-red-300 border border-red-900'
                  }`}
                >
                  {res.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>

              {/* Expected vs Actual Details */}
              <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 block font-sans">Expected:</span>
                  <span className="text-slate-300 font-mono text-[10px] break-all">
                    {typeof res.expected === 'object' ? JSON.stringify(res.expected) : String(res.expected)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-sans">Actual:</span>
                  <span className="text-white font-mono text-[10px] break-all">
                    {typeof res.actual === 'object' ? JSON.stringify(res.actual) : String(res.actual)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

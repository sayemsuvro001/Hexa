import React from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { AccentTheme, PermissionItem } from '../types/hexa';
import { HexCard } from './HexCard';

interface PermissionModalProps {
  permission: PermissionItem | null;
  accent: AccentTheme;
  onConfirm: () => void;
  onClose: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({
  permission,
  accent,
  onConfirm,
  onClose,
}) => {
  if (!permission) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#030714]/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-modal-title"
    >
      <div className="w-full max-w-md">
        <HexCard
          variant="outer"
          chamferSize={14}
          accent={accent}
          borderGlowIntensity={90}
          neonGlowIntensity={80}
          innerClassName="p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#0D1932] border border-[#00DFFF]/40 flex items-center justify-center text-[#00DFFF]">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 id="perm-modal-title" className="text-base font-semibold text-[#EAF4FF]">
                  {permission.title}
                </h2>
                <p className="font-mono-tech text-[11px] text-[#00DFFF]">
                  {permission.androidApi}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close permission dialog"
              className="w-8 h-8 rounded flex items-center justify-center text-[#8496B5] hover:text-[#EAF4FF]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3 text-sm text-[#EAF4FF]/90 leading-relaxed">
            <p>{permission.description}</p>
            <div className="p-3 rounded-lg bg-[#050A17] border border-[#1677E8]/30 text-xs text-[#8496B5]">
              <strong className="text-[#EAF4FF] block mb-1">Privacy Guarantee</strong>
              {permission.privacyNote}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[40px] rounded-lg border border-[#8496B5]/30 text-xs font-medium text-[#8496B5] hover:text-[#EAF4FF] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-4 py-2 min-h-[40px] rounded-lg bg-[#1677E8] hover:bg-[#00DFFF] hover:text-[#030714] text-xs font-semibold text-[#EAF4FF] transition-colors"
            >
              Continue & Request
            </button>
          </div>
        </HexCard>
      </div>
    </div>
  );
};

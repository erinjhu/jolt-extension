import { MISSING_DRIVE_SCOPE_MESSAGE } from '../services/authErrors';

interface DriveAccessCardProps {
  /**
   * `unchecked`: proactive notice that the permission was left off at sign-in.
   * `required`: the user just tried to use Drive and it was blocked.
   */
  variant: 'unchecked' | 'required';
  isBusy: boolean;
  onGrant: () => void;
}

/**
 * Monochrome alert card shown when Google Drive permission is missing. The
 * button re-runs Google consent so the permission checkbox appears again.
 */
export default function DriveAccessCard({ variant, isBusy, onGrant }: DriveAccessCardProps) {
  const isRequired = variant === 'required';
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-none border border-[#111111] bg-[#FAFAFA] p-4 text-[#111111]"
    >
      <p className="text-sm">
        {isRequired
          ? MISSING_DRIVE_SCOPE_MESSAGE
          : 'Google Drive permission was left unchecked during sign-in. Drive access is needed to create and pick documents.'}
      </p>
      <button
        type="button"
        onClick={onGrant}
        disabled={isBusy}
        className="self-start rounded-none border border-[#111111] bg-[#111111] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#FFFFFF] transition hover:bg-[#333333] disabled:opacity-50"
      >
        {isBusy ? 'Opening Google…' : isRequired ? 'Grant Drive Access' : 'Grant Google Drive Access'}
      </button>
    </div>
  );
}

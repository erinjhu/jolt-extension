import { useState } from 'react';

interface ProfileAvatarProps {
  name: string | null;
  email: string | null;
  picture: string | null;
}

/** Up to two uppercase initials from a name, else the email's first letter. */
function initialsFor(name: string | null, email: string | null): string {
  const fromName = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  return (fromName || (email ?? '').charAt(0)).toUpperCase();
}

/**
 * 32x32 circular avatar with a 1px #111111 border. Shows the Google profile
 * photo when available, otherwise initials, otherwise a monochrome silhouette.
 */
export default function ProfileAvatar({ name, email, picture }: ProfileAvatarProps) {
  // Remember a failed photo load so we fall back instead of showing a broken image.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = Boolean(picture) && picture !== failedUrl;
  const initials = initialsFor(name, email);

  return (
    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[#111111] bg-[#FFFFFF] text-xs font-bold text-[#111111]">
      {showPhoto ? (
        <img
          src={picture ?? undefined}
          alt=""
          // Google photo hosts often reject requests that carry a referrer.
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(picture)}
          className="h-full w-full object-cover"
        />
      ) : initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8z" />
        </svg>
      )}
    </span>
  );
}

import { cn } from '@/lib/utils';
import { getAvatar } from '@/lib/gamecast';

export function GameAvatar({
  avatarId,
  size = 'md',
  className,
}: {
  avatarId: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const avatar = getAvatar(avatarId);

  return (
    <span
      aria-label={`${avatar.label} avatar`}
      className={cn(
        'game-avatar',
        `game-avatar--${avatar.tone}`,
        `game-avatar--${size}`,
        className,
      )}
    >
      <span>{avatar.glyph}</span>
    </span>
  );
}

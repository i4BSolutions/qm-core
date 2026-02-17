"use client";

import Avatar from "boring-avatars";

interface UserAvatarProps {
  fullName: string;
  size?: number;
  className?: string;
}

export function UserAvatar({ fullName, size = 28, className }: UserAvatarProps) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", flexShrink: 0 }}
    >
      <Avatar
        name={fullName}
        variant="beam"
        size={size}
      />
    </span>
  );
}

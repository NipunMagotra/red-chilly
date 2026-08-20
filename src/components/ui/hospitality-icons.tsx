import React from 'react'

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string
  size?: number
}

/**
 * Minimal Restaurant / Cloche Dome Icon
 */
export function RestaurantClocheIcon({ className = 'w-5 h-5', size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Handle */}
      <path d="M12 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
      {/* Dome */}
      <path d="M3 17h18a9 9 0 0 0-18 0z" />
      {/* Base Platter */}
      <path d="M2 20h20" />
      {/* Accent Steam Sparkle */}
      <path d="M12 7v2" strokeDasharray="1 1" />
    </svg>
  )
}

/**
 * Minimal Gourmet Food / Meal Platter Icon
 */
export function FoodMealIcon({ className = 'w-5 h-5', size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Bowl */}
      <path d="M3 11c0 5 4 9 9 9s9-4 9-9H3z" />
      {/* Steam lines */}
      <path d="M8 4c0 1.5-1 2-1 3" />
      <path d="M12 3c0 1.5-1 2.5-1 4" />
      <path d="M16 4c0 1.5-1 2-1 3" />
      {/* Dish Rim Detail */}
      <path d="M2 11h20" />
    </svg>
  )
}

/**
 * Minimal Hotel / Resort Building Icon
 */
export function HotelBuildingIcon({ className = 'w-5 h-5', size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Building Frame */}
      <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />
      {/* Entrance Arch */}
      <path d="M10 21v-4a2 2 0 0 1 4 0v4" />
      {/* Hotel Windows */}
      <path d="M8 7h2" />
      <path d="M14 7h2" />
      <path d="M8 11h2" />
      <path d="M14 11h2" />
      <path d="M8 15h2" />
      <path d="M14 15h2" />
      {/* Ground line */}
      <path d="M2 21h20" />
    </svg>
  )
}

/**
 * Minimal Cutlery / In-Room Dining Icon
 */
export function DiningCutleryIcon({ className = 'w-5 h-5', size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Fork */}
      <path d="M6 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" />
      <path d="M8 3v18" />
      {/* Knife */}
      <path d="M16 3v18" />
      <path d="M16 3a3 3 0 0 1 3 3v5a1 1 0 0 1-1 1h-2" />
    </svg>
  )
}

/**
 * Minimal Cocktail / Bar Station Icon
 */
export function CocktailGlassIcon({ className = 'w-5 h-5', size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Glass */}
      <path d="M4 4l8 9 8-9H4z" />
      {/* Stem */}
      <path d="M12 13v7" />
      {/* Base */}
      <path d="M8 20h8" />
      {/* Olive Garnish */}
      <path d="M17 2l-3 4" />
    </svg>
  )
}

/**
 * Minimal Room Key & Stay PIN Icon
 */
export function RoomKeyCardIcon({ className = 'w-5 h-5', size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Keycard */}
      <rect x="3" y="5" width="18" height="14" rx="2" />
      {/* Magnetic Stripe / Chip */}
      <path d="M7 9h3" />
      <path d="M7 12h2" />
      <circle cx="16" cy="12" r="1.5" />
    </svg>
  )
}

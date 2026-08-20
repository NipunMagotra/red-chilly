import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { getGuestSession } from '@/actions/auth-actions'
import { getMenuItems } from '@/actions/tab-actions'
import { PinLockScreen } from '@/components/auth/pin-lock-screen'
import { DiningView } from '@/components/dining/dining-view'
import { tabManager } from '@/lib/data/restaurant-data'
import { GUEST_COOKIE_NAME } from '@/lib/auth/jwt'

interface RoomPageProps {
  params: {
    identifier: string
  }
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { identifier } = params

  // 1. Verify existence of location
  const locationMeta = tabManager.getLocationByIdentifier(identifier)
  if (!locationMeta) {
    notFound()
  }

  // 2. Check JWT guest cookie authentication
  const { isAuthenticated, session } = await getGuestSession(identifier)
  const menuItems = await getMenuItems()
  const cookieStore = cookies()
  const rawJwt = cookieStore.get(GUEST_COOKIE_NAME)?.value

  // 3. If unauthenticated, show the PIN Lock Screen Challenge (Never pass raw stayPin)
  if (!isAuthenticated || !session) {
    return (
      <PinLockScreen
        locationIdentifier={identifier}
        locationName={locationMeta.name}
        propertyName={locationMeta.propertyName}
      />
    )
  }

  // 4. Authenticated: Render Interactive Dining Menu & Continuous Tab with custom JWT for Realtime
  return <DiningView initialSession={session} menuItems={menuItems} sessionToken={rawJwt} />
}

'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function HomePage() {
  const [roomId, setRoomId] = useState('')
  const router = useRouter()

  async function handleCreateRoom() {
    const { data, error } = await supabase
      .from('rooms')
      .insert([{ candies: null, current_turn: null, winner: null }])
      .select()
      .single()

    if (data) router.push(`/game/${data.id}`)
  }

  function handleJoinRoom() {
    router.push(`/game/${roomId}`)
  }

  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-screen">
      <h1 className="text-3xl font-bold">🎯 Witch Poison</h1>
      <Button onClick={handleCreateRoom}>Create Room</Button>

      <div className="flex gap-2">
        <Input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Enter Room ID" />
        <Button onClick={handleJoinRoom}>Join</Button>
      </div>
    </div>
  )
}

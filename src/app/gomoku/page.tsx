'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function GomokuLobby() {
  const [roomId, setRoomId] = useState('')
  const router = useRouter()

  async function handleCreateRoom() {
    const size = 15;
    const emptyBoard = Array.from({length: size}, () => Array(size).fill('empty'))
    const { data } = await supabase
      .from('gomoku')
      .insert([{ board: emptyBoard, current_turn: 'playerA', winner: null }])
      .select()
      .single()

    if (data) router.push(`/gomoku/${data.id}`)
  }

  function handleJoinRoom() {
    if(!roomId){
        alert("请输入房间id")
        return
    }
    router.push(`/gomoku/${roomId}`)
  }

  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-screen">
      <h1 className="text-3xl font-bold">♟️五子棋♟️</h1>
      <Button onClick={handleCreateRoom}>Create Room</Button>

      <div className="flex gap-2">
        <Input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Enter Room ID" />
        <Button onClick={handleJoinRoom}>Join</Button>
      </div>
    </div>
  )
}

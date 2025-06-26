'use client'

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function ReactionLobby() {
  const [roomId, setRoomId] = useState('')
  const router = useRouter()

  // 创建玩家身份并保存（每次都确保有）
  function getOrCreatePlayerId() {
    let id = localStorage.getItem('reaction-player-id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('reaction-player-id', id)
    }
    return id
  }

  async function handleCreateRoom() {
    const playerId = getOrCreatePlayerId()

    const { data, error } = await supabase
      .from('reaction_rooms')
      .insert([{ player1_id: playerId }])
      .select()
      .single()

    if (error) {
      alert('房间创建失败')
      console.error(error)
      return
    }

    if (data) router.push(`/reaction/${data.id}`)
  }

  function handleJoinRoom() {
    if (!roomId) {
      alert("请输入房间id")
      return
    }

    getOrCreatePlayerId() // 加入房间前确保有 playerId

    router.push(`/reaction/${roomId}`)
  }

  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-screen">
      <h1 className="text-3xl font-bold">⚡️ Reaction</h1>
      <Button onClick={handleCreateRoom}>Create Room</Button>
      <div className="flex gap-2">
        <Input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Enter Room ID"
        />
        <Button onClick={handleJoinRoom}>Join</Button>
      </div>
    </div>
  )
}

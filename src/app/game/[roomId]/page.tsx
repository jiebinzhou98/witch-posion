'use client'

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { v4 as uuidv4 } from "uuid"

type Candy = {
  type: 'safe' | 'poison'
  clicked: boolean
}

type Room = {
  id: number
  candies: Candy[] | null
  poisonAIndex: number | null
  poisonBIndex: number | null
  current_turn: 'choosePoisonA' | 'choosePoisonB' | 'playerA' | 'playerB'
  winner: string | null
  playerA: string | null
  playerB: string | null
}

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>()
  const numericRoomId = Number(roomId)
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'playerA' | 'playerB' | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let id = localStorage.getItem('playerId')
    if (!id) {
      id = uuidv4()
      localStorage.setItem('playerId', id)
    }
    setPlayerId(id)
  }, [])

  useEffect(() => {
    async function fetchRoom() {
      const { data } = await supabase.from('rooms').select('*').eq('id', numericRoomId).single()
      if (data) setRoom(data)
      setLoading(false)
    }
    if (roomId) fetchRoom()
  }, [numericRoomId, roomId])

  useEffect(() => {
    if (!numericRoomId) return
    const channel = supabase
      .channel('room-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${numericRoomId}`,
      }, (payload) => {
        const newData = payload.new as Room
        setRoom(newData)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [numericRoomId])

  useEffect(() => {
    if (!room || !playerId) return
    if (!room.playerA) {
      supabase.from('rooms').update({ playerA: playerId }).eq('id', numericRoomId)
    } else if (room.playerA === playerId) {
      setRole('playerA')
    } else if (!room.playerB) {
      supabase.from('rooms').update({ playerB: playerId }).eq('id', numericRoomId)
    } else if (room.playerB === playerId) {
      setRole('playerB')
    }
  }, [room, playerId, numericRoomId])

  useEffect(() => {
    if (!room || !playerId) return
    if (room.playerA === playerId) setRole('playerA')
    if (room.playerB === playerId) setRole('playerB')
  }, [room, playerId])

  useEffect(() => {
    if (!room || room.candies?.length || !room.playerA || !room.playerB) return
    handleGenerateCandies()
  }, [room])

  async function handleGenerateCandies() {
    const total = 25
    const candies: Candy[] = Array(total).fill(null).map(() => ({ type: 'safe', clicked: false }))
    await supabase.from('rooms').update({
      candies, current_turn: 'choosePoisonA', winner: null, poisonAIndex: null, poisonBIndex: null
    }).eq('id', numericRoomId)
  }

  async function handleSelectPoisonA(index: number) {
    await supabase.from('rooms').update({ poisonAIndex: index, current_turn: 'choosePoisonB' }).eq('id', numericRoomId)
  }

  async function handleSelectPoisonB(index: number) {
    await supabase.from('rooms').update({ poisonBIndex: index, current_turn: 'playerA' }).eq('id', numericRoomId)
  }

  async function handleClickCandy(index: number) {
    if (!room || !room.candies || room.winner) return
    if (room.current_turn !== role) {
      alert("还没轮到你呢！")
      return
    }
    const candies = [...room.candies]
    candies[index].clicked = true

    let poisoned = false
    if (role === 'playerA' && index === room.poisonBIndex) poisoned = true
    if (role === 'playerB' && index === room.poisonAIndex) poisoned = true

    if (poisoned) {
      await supabase.from('rooms')
        .update({ winner: role === 'playerA' ? 'playerB' : 'playerA', candies })
        .eq('id', numericRoomId)
    } else {
      const nextTurn = role === 'playerA' ? 'playerB' : 'playerA'
      await supabase.from('rooms')
        .update({ current_turn: nextTurn, candies })
        .eq('id', numericRoomId)
    }
  }

  if (!room || !role || loading || !playerId) return <div>Loading...</div>

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-bold">Witch Poison 🎯</h1>
      <div className="text-lg">你是：{role}</div>
      <div className="text-lg">当前轮到：{room?.current_turn}</div>

      {room?.candies && (
        <div className="grid grid-cols-5 gap-4">
          {room.candies.map((candy, index) => {
            if (room.current_turn === 'choosePoisonA' && role === 'playerA') {
              return <Button key={index} onClick={() => handleSelectPoisonA(index)}>🍬</Button>
            }
            if (room.current_turn === 'choosePoisonB' && role === 'playerB') {
              return <Button key={index} onClick={() => handleSelectPoisonB(index)}>🍬</Button>
            }
            return (
              <Button key={index} onClick={() => handleClickCandy(index)} variant={candy.clicked ? 'secondary' : 'default'} disabled={candy.clicked}>🍬</Button>
            )
          })}
        </div>
      )}

      {room?.winner && (
        <div className="text-2xl font-bold text-red-500">🎉 胜者: {room.winner}</div>
      )}
    </div>
  )
}

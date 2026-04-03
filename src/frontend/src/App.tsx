import { useCallback, useState } from "react";
import GameOver from "./components/GameOver";
import GameScreen from "./components/GameScreen";
import LobbyScreen from "./components/LobbyScreen";

export type Screen = "lobby" | "game" | "gameover";

export interface RoomInfo {
  roomCode: string;
  playerId: string;
  playerName: string;
  mode: "solo" | "duo";
  isCreator: boolean;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [winner, setWinner] = useState<string>("");

  const handleJoinGame = useCallback((info: RoomInfo) => {
    setRoomInfo(info);
    setScreen("game");
  }, []);

  const handleGameOver = useCallback((winnerName: string) => {
    setWinner(winnerName);
    setScreen("gameover");
  }, []);

  const handleBackToLobby = useCallback(() => {
    setRoomInfo(null);
    setWinner("");
    setScreen("lobby");
  }, []);

  if (screen === "lobby") {
    return <LobbyScreen onJoinGame={handleJoinGame} />;
  }
  if (screen === "game" && roomInfo) {
    return <GameScreen roomInfo={roomInfo} onGameOver={handleGameOver} />;
  }
  return (
    <GameOver
      winner={winner}
      onPlayAgain={handleBackToLobby}
      onLobby={handleBackToLobby}
    />
  );
}

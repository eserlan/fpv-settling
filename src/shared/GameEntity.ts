// Shared Type Definition for Game Entities (Player | AI)

export interface AIPlayerInterface {
	UserId: number;
	Name: string;
	Character?: Model;
	IsAI: boolean;
	Kick(message?: string): void;
}

export type GameEntity = Player | AIPlayerInterface;

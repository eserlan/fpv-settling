-- NPC Types (Workers and Guards)
local NPCTypes = {
	Worker = {
		Name = "Worker",
		Description = "Gathers resources and constructs buildings",
		HireCost = {
			Gold = 50,
			Food = 10
		},
		MaintenanceCost = {
			Food = 1 -- per minute
		},
		GatherRate = 5, -- resources per minute
		Health = 50,
		Speed = 16
	},
	Guard = {
		Name = "Guard",
		Description = "Defends settlements from threats",
		HireCost = {
			Gold = 100,
			Food = 15
		},
		MaintenanceCost = {
			Food = 2 -- per minute
		},
		Health = 100,
		Speed = 18,
		Damage = 10,
		AttackRange = 20,
		DetectionRange = 50
	}
}

return NPCTypes

-- Server-side Network Handler
-- Routes requests from clients to the appropriate managers

local Network = require(game.ReplicatedStorage.Shared.Network)

local NetworkHandler = {}

function NetworkHandler.Init(gameManager)
	Network:OnEvent("ClientRequest", function(player, actionType, ...)
		local playerData = gameManager.PlayerData[player.UserId]
		if not playerData then return end
		
		if actionType == "PlaceBuilding" then
			local buildingType, position = ...
			playerData.BuildingManager:StartBuilding(buildingType, position)
			
		elseif actionType == "HireNPC" then
			local npcType, position = ...
			playerData.NPCManager:HireNPC(npcType, position)
			
		elseif actionType == "StartResearch" then
			local techName = ...
			playerData.ResearchManager:StartResearch(techName)
		end
	end)
	
	print("Network Handler initialized!")
end

return NetworkHandler

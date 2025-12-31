-- Server-side Network Handler
-- Routes requests from clients to the appropriate managers

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Network = require(ReplicatedStorage.Shared.Network)
local Logger = require(ReplicatedStorage.Shared.Logger)

local NetworkHandler = {}

function NetworkHandler.Init(gameManager)
	Network:OnEvent("ClientRequest", function(player, actionType, ...)
		local playerData = gameManager.PlayerData[player.UserId]
		if not playerData then return end
		
		if actionType == "PlaceBuilding" then
			local buildingType, position = ...
			playerData.BuildingManager:StartBuilding(buildingType, position)
			
		elseif actionType == "PlaceFoundation" then
			-- New blueprint building system
			local blueprintName, position = ...
			playerData.BuildingManager:PlaceFoundation(blueprintName, position)
			
		elseif actionType == "DepositResource" then
			-- Deposit resource into foundation
			local foundationId, resourceType = ...
			
			-- First check if player has the resource
			local CollectionManager = require(script.Parent.CollectionManager)
			local inventory = CollectionManager.GetInventory(player)
			
			if inventory and inventory[resourceType] and inventory[resourceType] > 0 then
				-- Try to deposit
				local success = playerData.BuildingManager:DepositResource(foundationId, resourceType)
				if success then
					-- Remove from player inventory
					CollectionManager.RemoveResource(player, resourceType, 1)
				end
			else
				Logger.Warn("NetworkHandler", player.Name .. " tried to deposit " .. resourceType .. " but doesn't have any")
			end
			
		elseif actionType == "HireNPC" then
			local npcType, position = ...
			playerData.NPCManager:HireNPC(npcType, position)
			
		elseif actionType == "StartResearch" then
			local techName = ...
			playerData.ResearchManager:StartResearch(techName)
		end
	end)
	
	Logger.Info("NetworkHandler", "Initialized")
end

return NetworkHandler

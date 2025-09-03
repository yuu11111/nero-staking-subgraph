import {
  AdminChanged as AdminChangedEvent,
  AdminChanging as AdminChangingEvent,
  ClaimWithoutUnboundStake as ClaimWithoutUnboundStakeEvent,
  FounderUnlocked as FounderUnlockedEvent,
  LogDecreaseMissedBlocksCounter as LogDecreaseMissedBlocksCounterEvent,
  LogDoubleSignPunishValidator as LogDoubleSignPunishValidatorEvent,
  LogLazyPunishValidator as LogLazyPunishValidatorEvent,
  PermissionLess as PermissionLessEvent,
  StakeWithdrawn as StakeWithdrawnEvent,
  StakingRewardsEmpty as StakingRewardsEmptyEvent,
  TotalStakeChanged as TotalStakeChangedEvent,
  ValidatorRegistered as ValidatorRegisteredEvent,
  Staking as StakingContract,
} from "../../generated/Staking/Staking";
import {
  AdminChange,
  ClaimWithoutUnbound,
  FounderUnlock,
  PermissionToggle,
  Punishment,
  StakingGlobal,
  TotalStakeChange,
  Validator,
  Withdrawal,
} from "../../generated/schema";
import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts";

function getGlobal(
  contract: StakingContract,
  block: ethereum.Block
): StakingGlobal {
  let id = "global";
  let g = StakingGlobal.load(id);
  if (g == null) {
    g = new StakingGlobal(id);
    g.totalStake = BigInt.zero();
    g.totalValidators = 0;
  }
  // Try/catch to prevent reverts from breaking the handler
  let adminCall = contract.try_admin();
  if (!adminCall.reverted) g.admin = adminCall.value;
  let pendingCall = contract.try_pendingAdmin();
  if (!pendingCall.reverted) g.pendingAdmin = pendingCall.value;
  let totalStakeCall = contract.try_totalStake();
  if (!totalStakeCall.reverted) g.totalStake = totalStakeCall.value;
  let accCall = contract.try_accRewardsPerStake();
  if (!accCall.reverted) g.accRewardsPerStake = accCall.value;
  let lastUpdateCall = contract.try_lastUpdateAccBlock();
  if (!lastUpdateCall.reverted) g.lastUpdateAccBlock = lastUpdateCall.value;
  let openedCall = contract.try_isOpened();
  if (!openedCall.reverted) g.permissionlessOpen = openedCall.value;
  g.updatedAt = block.timestamp;
  return g as StakingGlobal;
}

function getOrCreateValidator(
  id: Address,
  block: ethereum.Block,
  contract: StakingContract
): Validator {
  let v = Validator.load(id.toHexString());
  if (v == null) {
    v = new Validator(id.toHexString());
    v.stake = BigInt.zero();
    v.createdAt = block.timestamp;
  }
  // hydrate from valInfos if possible
  let infos = contract.try_valInfos(id);
  if (!infos.reverted) {
    // use getters from Staking__valInfosResult
    v.stake = infos.value.getStake();
    v.debt = infos.value.getDebt();
    v.incomeFees = infos.value.getIncomeFees();
    v.unWithdrawn = infos.value.getUnWithdrawn();
  }
  // manager from valMaps mapping (contract IValidator)
  let vm = contract.try_valMaps(id);
  if (!vm.reverted) {
    v.manager = vm.value;
  }
  v.updatedAt = block.timestamp;
  return v as Validator;
}

export function handleAdminChanged(event: AdminChangedEvent): void {
  let entity = new AdminChange(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  entity.oldAdmin = event.params.oldAdmin;
  entity.newAdmin = event.params.newAdmin;
  entity.pending = false;
  entity.txHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.timestamp = event.block.timestamp;

  let contract = StakingContract.bind(event.address);
  let g = getGlobal(contract, event.block);
  g.admin = event.params.newAdmin;
  g.save();

  entity.save();
}

export function handleAdminChanging(event: AdminChangingEvent): void {
  let entity = new AdminChange(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  entity.newAdmin = event.params.newAdmin;
  entity.pending = true;
  entity.txHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.timestamp = event.block.timestamp;

  let contract = StakingContract.bind(event.address);
  let g = getGlobal(contract, event.block);
  g.pendingAdmin = event.params.newAdmin;
  g.save();

  entity.save();
}

export function handleStakeWithdrawn(event: StakeWithdrawnEvent): void {
  let contract = StakingContract.bind(event.address);
  let v = getOrCreateValidator(event.params.val, event.block, contract);
  let w = new Withdrawal(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  w.validator = v.id;
  w.recipient = event.params.recipient;
  w.amount = event.params.amount;
  w.txHash = event.transaction.hash;
  w.blockNumber = event.block.number;
  w.timestamp = event.block.timestamp;
  w.save();

  // refresh snapshot
  v = getOrCreateValidator(event.params.val, event.block, contract);
  v.save();

  let g = getGlobal(contract, event.block);
  g.save();
}

export function handleTotalStakeChanged(event: TotalStakeChangedEvent): void {
  let t = new TotalStakeChange(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  t.changer = event.params.changer;
  t.oldStake = event.params.oldStake;
  t.newStake = event.params.newStake;
  t.blockNumber = event.block.number;
  t.timestamp = event.block.timestamp;
  t.save();

  let contract = StakingContract.bind(event.address);
  let g = getGlobal(contract, event.block);
  g.totalStake = event.params.newStake;
  g.save();
}

export function handlePermissionLess(event: PermissionLessEvent): void {
  let p = new PermissionToggle(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  p.opened = event.params.opened;
  p.blockNumber = event.block.number;
  p.timestamp = event.block.timestamp;
  p.save();

  let contract = StakingContract.bind(event.address);
  let g = getGlobal(contract, event.block);
  g.permissionlessOpen = event.params.opened;
  g.save();
}

export function handleValidatorRegistered(
  event: ValidatorRegisteredEvent
): void {
  let contract = StakingContract.bind(event.address);
  let v = getOrCreateValidator(event.params.val, event.block, contract);
  v.manager = event.params.manager;
  v.commissionRate = event.params.commissionRate;
  v.stake = event.params.stake;
  v.state = event.params.st;
  v.save();

  let g = getGlobal(contract, event.block);
  g.totalValidators = g.totalValidators + 1;
  g.save();
}

export function handleStakingRewardsEmpty(
  event: StakingRewardsEmptyEvent
): void {
  let contract = StakingContract.bind(event.address);
  let g = getGlobal(contract, event.block);
  g.stakingRewardsEmpty = event.params.empty;
  g.save();
}

export function handleClaimWithoutUnboundStake(
  event: ClaimWithoutUnboundStakeEvent
): void {
  let contract = StakingContract.bind(event.address);
  let v = getOrCreateValidator(event.params.val, event.block, contract);
  v.save();
  let c = new ClaimWithoutUnbound(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  c.val = v.id;
  c.txHash = event.transaction.hash;
  c.blockNumber = event.block.number;
  c.timestamp = event.block.timestamp;
  c.save();
}

export function handleFounderUnlocked(event: FounderUnlockedEvent): void {
  let contract = StakingContract.bind(event.address);
  let v = getOrCreateValidator(event.params.val, event.block, contract);
  v.save();
  let f = new FounderUnlock(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  f.val = v.id;
  f.txHash = event.transaction.hash;
  f.blockNumber = event.block.number;
  f.timestamp = event.block.timestamp;
  f.save();
}

export function handleLogDoubleSignPunishValidator(
  event: LogDoubleSignPunishValidatorEvent
): void {
  let contract = StakingContract.bind(event.address);
  let v = getOrCreateValidator(event.params.val, event.block, contract);
  v.save();
  let p = new Punishment(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  p.validator = v.id;
  p.kind = "double";
  p.time = event.params.time;
  p.blockNumber = event.block.number;
  p.timestamp = event.block.timestamp;
  p.save();
}

export function handleLogLazyPunishValidator(
  event: LogLazyPunishValidatorEvent
): void {
  let contract = StakingContract.bind(event.address);
  let v = getOrCreateValidator(event.params.val, event.block, contract);
  v.save();
  let p = new Punishment(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  p.validator = v.id;
  p.kind = "lazy";
  p.time = event.params.time;
  p.blockNumber = event.block.number;
  p.timestamp = event.block.timestamp;
  p.save();
}

export function handleLogDecreaseMissedBlocksCounter(
  _: LogDecreaseMissedBlocksCounterEvent
): void {
  // Event emitted without params; we could track a counter if needed in the future.
}

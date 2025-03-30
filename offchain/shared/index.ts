import { Core } from "@blaze-cardano/sdk";
import { TreasuryConfiguration, TreasuryTreasuryWithdraw, VendorConfiguration, VendorVendorSpend } from "../types/contracts";

export function loadTreasuryScript(network: Core.NetworkId, config: TreasuryConfiguration) {
  const script = new TreasuryTreasuryWithdraw(config);
  const credential = {
    type: Core.CredentialType.ScriptHash,
    hash: script.Script.hash(),
  };
  const rewardAccount = Core.RewardAccount.fromCredential(credential, network);
  const scriptAddress = new Core.Address({
    type: Core.AddressType.EnterpriseScript,
    networkId: network,
    paymentPart: credential,
  });
  return {
    script,
    credential,
    rewardAccount,
    scriptAddress,
  };
}

export function loadVendorScript(network: Core.NetworkId, config: VendorConfiguration) {
  const script = new VendorVendorSpend(config);
  const credential = {
    type: Core.CredentialType.ScriptHash,
    hash: script.Script.hash(),
  };
  const scriptAddress = new Core.Address({
    type: Core.AddressType.EnterpriseScript,
    networkId: network,
    paymentPart: credential,
  });
  return {
    script,
    credential,
    scriptAddress,
  };
}

export function loadScripts(network: Core.NetworkId, treasuryConfig: TreasuryConfiguration, vendorConfig: VendorConfiguration) {
  const treasuryScript = loadTreasuryScript(network, treasuryConfig);
  const vendorScript = loadVendorScript(network, vendorConfig);
  return {
    treasuryScript,
    vendorScript,
  };
}

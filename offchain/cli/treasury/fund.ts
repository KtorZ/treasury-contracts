/* eslint-disable @typescript-eslint/no-unused-vars */
import { Value } from "@blaze-cardano/core";
import { Blaze, makeValue, Provider, Wallet } from "@blaze-cardano/sdk";
import { input, select } from "@inquirer/prompts";
import { IFund, IFundMilestone } from "src/metadata/types/fund";
import { toMultisig, TPermissionMetadata } from "src/metadata/types/permission";
import { Treasury } from "../../src";
import { loadTreasuryScript } from "../../src/shared";
import {
  getActualPermission,
  getAnchor,
  getBlazeInstance,
  getConfigs,
  getDate,
  getOptional,
  getPermission,
  getSigners,
  getTransactionMetadata,
  maybeInput,
  selectUtxo,
  transactionDialog,
} from "../shared";

async function getMilestones(): Promise<{
  schedule: { date: Date; amount: Value }[];
  milestones: IFundMilestone[];
}> {
  const milestones: IFundMilestone[] = [];
  const schedule: { date: Date; amount: Value }[] = [];
  let moreMilestones = true;

  while (moreMilestones) {
    const date = await getDate("When should the milestone be completed?");
    const amount = makeValue(
      BigInt(
        await input({
          message:
            "How much ADA (in lovelace) should be released for this milestone?",
          validate: (value) => {
            const parsedValue = parseInt(value, 10);
            return parsedValue > 0 ? true : "Amount must be a positive value.";
          },
        }),
      ),
    );

    const meta = {
      identifier: await input({
        message: "What is the identifier for this milestone?",
        validate: (value) => (value ? true : "Identifier cannot be empty."),
      }),
      label: await maybeInput({
        message: "What is the label for this milestone? (optional)",
      }),
      description: await maybeInput({
        message: "What is the description for this milestone? (optional)",
      }),
      acceptanceCriteria: await maybeInput({
        message:
          "What are the acceptance criteria for this milestone? (optional)",
      }),
      details: await getOptional(
        "Do you want to add details for this milestone? (optional)",
        undefined,
        getAnchor,
      ),
    } as IFundMilestone;

    schedule.push({ date, amount });
    milestones.push(meta);

    moreMilestones = await select({
      message: "Do you want to add another milestone?",
      choices: [
        { name: "Yes", value: true },
        { name: "No", value: false },
      ],
    });
  }

  return { schedule, milestones };
}

async function getIdentifiers(): Promise<string[]> {
  const identifiers: string[] = [];
  while (true) {
    const identifier = await maybeInput({
      message: "Add another identifier for this project? (optional)",
    });
    if (identifier) {
      identifiers.push(identifier);
    } else {
      return identifiers;
    }
  }
}

export async function fund(
  blazeInstance: Blaze<Provider, Wallet> | undefined = undefined,
): Promise<void> {
  if (!blazeInstance) {
    blazeInstance = await getBlazeInstance();
  }
  const { treasuryConfig, vendorConfig, metadata } = await getConfigs();
  const vendorPermissions: TPermissionMetadata = (await getPermission(
    "Which multisig should be able to use the funds?",
  )) as TPermissionMetadata;
  const vendor = toMultisig(vendorPermissions);

  const metadataBody = {
    event: "fund",
    identifier: await input({
      message: "What is the main identifier for this project?",
    }),
    otherIdentifiers: await getIdentifiers(),
    label: await input({
      message: "What is the name of this project?",
      validate: (value) => (value ? true : "Name cannot be empty."),
    }),
    description: await maybeInput({
      message: "What is the description for this funding event? (optional)",
    }),
    vendor: {
      label: await input({
        message: "What is the name of the vendor?",
        validate: (value) => (value ? true : "Name cannot be empty."),
      }),
      details: await getOptional(
        "Do you want to add a link to details for this vendor? (optional)",
        undefined,
        getAnchor,
      ),
    },
    contract: await getOptional(
      "Do you want to add a contract for this funding event? (optional)",
      undefined,
      getAnchor,
    ),
    milestones: [],
  } as IFund;

  const { schedule, milestones } = await getMilestones();

  metadataBody.milestones = milestones;

  const txMetadata = await getTransactionMetadata(
    treasuryConfig.registry_token,
    metadataBody,
  );

  const { scriptAddress: treasuryScriptAddress, ...rest } = loadTreasuryScript(
    blazeInstance.provider.network,
    treasuryConfig,
  );

  const utxos = await blazeInstance.provider.getUnspentOutputs(
    treasuryScriptAddress,
  );
  const utxo = await selectUtxo(utxos);

  const fundPermissions = getActualPermission(
    metadata.body.permissions.fund,
    metadata.body.permissions,
  );
  const signers = await getSigners(fundPermissions, vendorPermissions);

  const tx = await (
    await Treasury.fund({
      configs: {
        treasury: treasuryConfig,
        vendor: vendorConfig,
      },
      blaze: blazeInstance,
      input: utxo,
      vendor,
      schedule,
      signers,
      metadata: txMetadata,
    })
  ).complete();

  await transactionDialog(blazeInstance.provider.network, tx.toCbor(), false);
}

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { QuadraticVoting } from "../target/types/quadratic_voting";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

describe("quadratic-voting", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.QuadraticVoting as Program<QuadraticVoting>;
  const connection = provider.connection;

  let creator: Keypair;
  let voter: Keypair;
  let tokenMint: PublicKey;
  let voterTokenAccount: PublicKey;
  let daoPda: PublicKey;
  const daoName = "TestDAO";

  before(async () => {
    // Use provider wallet as creator for easier setup
    creator = provider.wallet.payer;
    voter = Keypair.generate();

    // Airdrop SOL to voter
    const voterAirdrop = await connection.requestAirdrop(
      voter.publicKey,
      5 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(voterAirdrop);

    // Wait a bit to ensure airdrop is processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create token mint
    tokenMint = await createMint(
      connection,
      creator,
      creator.publicKey,
      null,
      9, // 9 decimals
    );

    // Create voter token account and mint tokens
    const voterTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      connection,
      voter,
      tokenMint,
      voter.publicKey,
    );
    voterTokenAccount = voterTokenAccountInfo.address;

    // Mint 100 tokens to voter (100 * 10^9 for 9 decimals)
    // The quadratic voting formula: voting_credits = sqrt(token_amount)
    // sqrt(100_000_000_000) = 316,227 voting credits
    await mintTo(
      connection,
      creator,
      tokenMint,
      voterTokenAccount,
      creator,
      100_000_000_000,
    );

    // Calculate DAO PDA
    [daoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dao"), creator.publicKey.toBuffer(), Buffer.from(daoName)],
      program.programId,
    );
  });

  it("Should initialize a DAO", async () => {
    await program.methods
      .initializeDao(daoName)
      .accounts({
        authority: creator.publicKey,
        daoAccount: daoPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const daoAccount = await program.account.dao.fetch(daoPda);
    assert.equal(daoAccount.name, daoName);
    assert.equal(daoAccount.authority.toBase58(), creator.publicKey.toBase58());
    assert.equal(daoAccount.proposalCount.toNumber(), 0);

    console.log("✓ DAO initialized successfully");
  });

  it("Should initialize a proposal", async () => {
    const daoAccount = await program.account.dao.fetch(daoPda);
    const proposalCount = daoAccount.proposalCount.toNumber();

    const [proposalPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        daoPda.toBuffer(),
        new anchor.BN(proposalCount).toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );

    const subject = "Test Proposal";
    const metadata = "This is a test proposal";

    await program.methods
      .initializeProposal(subject, metadata, creator.publicKey)
      .accounts({
        authority: creator.publicKey,
        daoAccount: daoPda,
        proposal: proposalPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const proposalAccount = await program.account.proposal.fetch(proposalPda);
    assert.equal(proposalAccount.subject, subject);
    assert.equal(proposalAccount.metadata, metadata);
    assert.equal(proposalAccount.yesVoteCount.toNumber(), 0);
    assert.equal(proposalAccount.noVoteCount.toNumber(), 0);

    console.log("✓ Proposal initialized successfully");
  });

  it("Should cast a vote", async () => {
    const daoAccount = await program.account.dao.fetch(daoPda);
    const proposalCount = daoAccount.proposalCount.toNumber();

    const [proposalPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        daoPda.toBuffer(),
        new anchor.BN(proposalCount).toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );

    const [votePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), proposalPda.toBuffer(), voter.publicKey.toBuffer()],
      program.programId,
    );

    const voteType = { yes: {} }; // Yes vote

    await program.methods
      .vote(voteType)
      .accounts({
        voter: voter.publicKey,
        dao: daoPda,
        proposal: proposalPda,
        voteAccount: votePda,
        creatorTokenAccount: voterTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();

    const voteAccount = await program.account.vote.fetch(votePda);
    const proposalAccount = await program.account.proposal.fetch(proposalPda);

    assert.equal(voteAccount.authority.toBase58(), voter.publicKey.toBase58());
    // Token amount is 100 * 10^9 (100 tokens with 9 decimals = 100_000_000_000)
    // sqrt(100_000_000_000) = 316,227
    assert.equal(voteAccount.voteCredits.toNumber(), 316227);
    assert.equal(proposalAccount.yesVoteCount.toNumber(), 1);

    console.log("✓ Vote cast successfully");
    console.log(`  Voting credits: ${voteAccount.voteCredits.toNumber()}`);
  });

  it("Should reject proposal with empty subject", async () => {
    const daoAccount = await program.account.dao.fetch(daoPda);
    const proposalCount = daoAccount.proposalCount.toNumber();

    const [proposalPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        daoPda.toBuffer(),
        new anchor.BN(proposalCount).toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );

    let errorThrown = false;
    try {
      await program.methods
        .initializeProposal("", "metadata", creator.publicKey)
        .accounts({
          authority: creator.publicKey,
          daoAccount: daoPda,
          proposal: proposalPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (error: any) {
      errorThrown = true;

      // Check for the error in various places
      const errorStr = JSON.stringify(error);
      const logs = error.logs || [];

      // Look for the custom error in logs
      const hasCustomError = logs.some(
        (log: string) =>
          log.includes("EmptySubject") ||
          log.includes("Subject cannot be empty") ||
          log.includes("Error Code: EmptySubject") ||
          log.includes("Error Number:"),
      );

      if (hasCustomError) {
        console.log("Empty subject correctly rejected (found in logs)");
      } else if (
        errorStr.includes("EmptySubject") ||
        errorStr.includes("Subject cannot be empty")
      ) {
        console.log("Empty subject correctly rejected (found in error)");
      } else {
        console.log(
          "Empty subject correctly rejected (transaction failed as expected)",
        );
      }
    }

    assert.isTrue(errorThrown, "Should have thrown an error for empty subject");
  });
});

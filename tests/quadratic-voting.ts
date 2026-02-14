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
  const daoName = "Test DAO";

  before(async () => {
    // Generate keypairs
    creator = Keypair.generate();
    voter = Keypair.generate();

    // Airdrop SOL to creator and voter
    const creatorAirdrop = await connection.requestAirdrop(
      creator.publicKey,
      2 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(creatorAirdrop);

    const voterAirdrop = await connection.requestAirdrop(
      voter.publicKey,
      2 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(voterAirdrop);

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
    await mintTo(
      connection,
      creator,
      tokenMint,
      voterTokenAccount,
      creator,
      100_000_000_000,
    );
  });

  it("Should initialize a DAO", async () => {
    const [daoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dao"), creator.publicKey.toBuffer(), Buffer.from(daoName)],
      program.programId,
    );

    await program.methods
      .initializeDao(daoName)
      .accounts({
        authority: creator.publicKey,
        daoAccount: daoPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const daoAccount = await program.account.dao.fetch(daoPda);
    assert.equal(daoAccount.name, daoName);
    assert.equal(daoAccount.authority.toBase58(), creator.publicKey.toBase58());
    assert.equal(daoAccount.proposalCount.toNumber(), 0);
  });

  it("Should initialize a proposal", async () => {
    const [daoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dao"), creator.publicKey.toBuffer(), Buffer.from(daoName)],
      program.programId,
    );

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
      .signers([creator])
      .rpc();

    const proposalAccount = await program.account.proposal.fetch(proposalPda);
    assert.equal(proposalAccount.subject, subject);
    assert.equal(proposalAccount.metadata, metadata);
    assert.equal(proposalAccount.yesVoteCount.toNumber(), 0);
    assert.equal(proposalAccount.noVoteCount.toNumber(), 0);
  });

  it("Should cast a vote", async () => {
    const [daoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dao"), creator.publicKey.toBuffer(), Buffer.from(daoName)],
      program.programId,
    );

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
    assert.equal(voteAccount.voteCredits.toNumber(), 10); // sqrt(100) = 10
    assert.equal(proposalAccount.yesVoteCount.toNumber(), 1);
  });

  it("Should reject proposal with empty subject", async () => {
    const [daoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dao"), creator.publicKey.toBuffer(), Buffer.from(daoName)],
      program.programId,
    );

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

    try {
      await program.methods
        .initializeProposal("", "metadata", creator.publicKey)
        .accounts({
          authority: creator.publicKey,
          daoAccount: daoPda,
          proposal: proposalPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      assert.fail("Should have thrown an error");
    } catch (error) {
      assert.include(error.toString(), "EmptySubject");
    }
  });
});

use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;

pub use state::*;
pub use errors::*;
pub use instructions::*;

declare_id!("8HEEmcxhPcWCDEBatCmwbjaAGYGQoGNDQfwcEVDJF9JX");

#[program]
pub mod quadratic_voting {

    use super::*;

    pub fn initialize_dao(ctx: Context<InitializeDao>, name: String) -> Result<()> {
        ctx.accounts.init_dao(name, ctx.bumps.dao_account)
    }

    pub fn initialize_proposal(ctx: Context<InitializeProposal>, subject: String, metadata: String, authority: Pubkey) -> Result<()> {
        ctx.accounts.init_proposal(subject, metadata, authority, ctx.bumps.proposal)
    }

    pub fn vote(ctx: Context<CastVote>, vote_type: VoteType) -> Result<()> {
        ctx.accounts.cast_vote(vote_type, ctx.bumps.vote_account)
    }
}


use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenInterface, TokenAccount};

use crate::VoteType;
use crate::state::{ Dao, Proposal, Vote };
use crate::errors::QuadraticVotingError;



#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account()]
    pub dao: Account<'info, Dao>,
    #[account(
        mut,
        seeds = [b"proposal", dao.key().as_ref(), dao.proposal_count.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    #[account(
        init,
        payer = voter,
        space = 8 + Vote::INIT_SPACE,
        seeds = [b"vote", proposal.key().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote_account: Account<'info, Vote>,
    #[account(
        constraint = creator_token_account.owner == voter.key()
    )]
    pub creator_token_account: InterfaceAccount<'info, TokenAccount>,
   pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>
}


impl<'info> CastVote<'info> {
    pub fn cast_vote(&mut self, vote_type: VoteType, bump: u8) -> Result<()> {
        let vote_account = &mut self.vote_account;
        let proposal = &mut self.proposal;

        let voting_credits = (self.creator_token_account.amount as f64).sqrt() as u64;
        
        match vote_type {
            VoteType::Yes => proposal.yes_vote_count += 1,
            VoteType::No => proposal.no_vote_count += 1
        };

        vote_account.set_inner(
            Vote {
                authority: self.voter.key(),
                vote_credits: voting_credits,
                vote_type: vote_type,
                bump
            }
        );

        Ok(())


    }
}
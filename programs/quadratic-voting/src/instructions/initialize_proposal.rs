use anchor_lang::prelude::*;

use crate::state::{ Dao, Proposal };
use crate::errors::QuadraticVotingError;


#[derive(Accounts)]
pub struct InitializeProposal<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [b"dao", authority.key().as_ref(), dao_account.name.as_bytes()],
        bump = dao_account.bump
    )]
    pub dao_account: Account<'info, Dao>,
    #[account(
        init,
        payer = authority,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [b"proposal", dao_account.key().as_ref(), dao_account.proposal_count.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    pub system_program: Program<'info, System>
}


impl<'info> InitializeProposal<'info> {
    pub fn init_proposal(&mut self, subject: String, metadata: String, authority: Pubkey, bump: u8) -> Result<()> {
        //checks
        require!(!subject.is_empty(), QuadraticVotingError::EmptySubject);
        require!(subject.len() <= 300, QuadraticVotingError::SubjectTooLong);
        require!(metadata.len() <= 500, QuadraticVotingError::MetadataTooLong);

        
        self.proposal.set_inner(
            Proposal {
                subject,
                authority,
                metadata,
                yes_vote_count: 0,
                no_vote_count: 0,
                bump
            }
        );
        Ok(())

    }
}
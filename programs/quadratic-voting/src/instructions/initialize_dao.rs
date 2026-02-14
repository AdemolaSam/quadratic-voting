use anchor_lang::prelude::*;
use crate::state::Dao;


#[derive(Accounts)]
#[instruction(name: String)]
pub struct InitializeDao<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Dao::INIT_SPACE,
        seeds = [b"dao", authority.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub dao_account: Account<'info, Dao>,

    pub system_program: Program<'info, System>
}


impl<'info> InitializeDao<'info> {
    pub fn init_dao(&mut self, name: String, bump: u8) -> Result<()> {
    
        self.dao_account.set_inner(
            Dao {
                name,
                authority: self.authority.key(),
                proposal_count: 0,
                bump
            }
        );

        Ok(())
    }
}
use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct Dao {
    #[max_len(500)]
    pub name: String,
    pub authority: Pubkey,
    pub proposal_count: u64,
    pub bump: u8,
}

#[account]
#[derive(Debug, InitSpace)]
pub struct Proposal {
    #[max_len(300)]
    pub subject: String,
    pub authority: Pubkey,
    #[max_len(500)]
    pub metadata: String,
    pub yes_vote_count: u64,
    pub no_vote_count: u64,
    pub bump: u8,
}

#[repr(u8)]
#[derive(Debug, Clone, InitSpace, AnchorSerialize, AnchorDeserialize)]
pub enum VoteType {
    Yes,
    No
}

#[account]
#[derive(Debug, InitSpace)]
pub struct Vote {
    pub authority: Pubkey,
    pub vote_credits: u64,
    pub vote_type: VoteType,
    pub bump: u8,
}

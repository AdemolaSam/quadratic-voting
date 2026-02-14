use anchor_lang::prelude::*;

#[error_code]
pub enum QuadraticVotingError {
    #[msg("Unauthorized authority")]
    Unauthorized,
    #[msg("Invalid Proposal Count")]
    InvalidProposalCount,
    #[msg("Subject length exceeds maximum allowed")]
    SubjectTooLong,
    #[msg("Metadata length exceeds maximum allowed")]
    MetadataTooLong,
    #[msg("Subject is empty")]
    EmptySubject
}

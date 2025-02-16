import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';

describe('votee', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.Votee

  let PID: any, CID: any

  it('Initializes and creates a poll', async () => {
    const user = provider.wallet


    const [counterPDA] = await PublicKey.findProgramAddressSync(
      [Buffer.from('counter')],
      program.programId
    )

    const [registrationsPDA] = await PublicKey.findProgramAddressSync(
      [Buffer.from('registrations')],
      program.programId
    )


    let counter
    try {
      counter = await program.account.counter.fetch(counterPDA)
      console.log(
        'Counter account already exists with count:',
        counter.count.toString()
      )
    } catch (err) {
      console.log('Counter account does not exist. Initializing...')
      await program.methods
        .initialize()
        .accounts({
          user: user.publicKey,
          counter: counterPDA,
          registrations: registrationsPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();


      counter = await program.account.counter.fetch(counterPDA)
      console.log('Counter initialized with count:', counter.count.toString())
    }


    PID = counter.count.add(new anchor.BN(1))
    const [pollPda] = await PublicKey.findProgramAddressSync(
      [PID.toArrayLike(Buffer, 'le', 8)],
      program.programId
    )

    const description = `Test Poll #${PID}`
    const start = new anchor.BN(Date.now() / 1000)
    const end = new anchor.BN(Date.now() / 1000 + 86400)


    await program.rpc.createPoll(description, start, end, {
      accounts: {
        user: user.publicKey,
        poll: pollPda,
        counter: counterPDA,
        systemProgram: SystemProgram.programId,
      },
      signers: [],
    })


    const poll = await program.account.poll.fetch(pollPda)
    console.log('Poll:', poll)
  })

  it('Registers a candidate', async () => {
    const user = provider.wallet

    const [pollPda] = await PublicKey.findProgramAddressSync(
      [PID.toArrayLike(Buffer, 'le', 8)],
      program.programId
    )

    const [registrationsPDA] = await PublicKey.findProgramAddressSync(
      [Buffer.from('registrations')],
      program.programId
    )

    const regs = await program.account.registrations.fetch(registrationsPDA)
    CID = regs.count.add(new anchor.BN(1))

    const candidateName = `Candidate #${CID}`
    const [candidatePda] = await PublicKey.findProgramAddressSync(
      [
        PID.toArrayLike(Buffer, 'le', 8),
        CID.toArrayLike(Buffer, 'le', 8),
      ],
      program.programId
    )

    await program.rpc.registerCandidate(PID, candidateName, {
      accounts: {
        poll: pollPda,
        candidate: candidatePda,
        registrations: registrationsPDA,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      },
    })

    const candidate = await program.account.candidate.fetch(candidatePda)
    console.log('Candidate:', candidate)
  })

  it('Votes for a candidate', async () => {
    const user = provider.wallet


    const [pollPDA] = await PublicKey.findProgramAddressSync(
      [PID.toArrayLike(Buffer, 'le', 8)],
      program.programId
    )


    const [candidatePDA] = await PublicKey.findProgramAddressSync(
      [PID.toArrayLike(Buffer, 'le', 8), CID.toArrayLike(Buffer, 'le', 8)],
      program.programId
    )


    const [voterPDA] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from('voter'),
        PID.toArrayLike(Buffer, 'le', 8),
        user.publicKey.toBuffer(),
      ],
      program.programId
    )

    const candidate = await program.account.candidate.fetch(candidatePDA)
    if (!candidate) {
      throw new Error(`Candidate with ID ${CID} for poll ID ${PID} not found`)
    }

    await program.methods
      .vote(PID, CID)
      .accounts({
        user: user.publicKey,
        poll: pollPDA,
        candidate: candidatePDA,
        voter: voterPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const voterAccount = await program.account.voter.fetch(voterPDA)
    console.log('Voter Account:', voterAccount)


    const updatedCandidate = await program.account.candidate.fetch(candidatePDA)
    console.log(
      'Candidate Votes:',
      updatedCandidate.votes.toString()
    )
  })
})
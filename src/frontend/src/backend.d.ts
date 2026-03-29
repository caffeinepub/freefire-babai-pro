import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type Time = bigint;
export interface WalletTransaction {
    id: bigint;
    status: WalletTransactionStatus;
    transactionType: Variant_deposit_withdrawal;
    user: Principal;
    timestamp: Time;
    amount: bigint;
}
export interface Match {
    id: bigint;
    status: MatchStatus;
    player: Principal;
    timestamp: Time;
}
export interface UserProfile {
    username: string;
    password: string;
    wallet: bigint;
}
export enum MatchStatus {
    completed = "completed",
    waiting = "waiting",
    inProgress = "inProgress"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum Variant_deposit_withdrawal {
    deposit = "deposit",
    withdrawal = "withdrawal"
}
export enum WalletTransactionStatus {
    pending = "pending",
    approved = "approved",
    rejected = "rejected"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getAllUsers(): Promise<Array<UserProfile>>;
    getAllUsersWithWalletOver(amount: bigint): Promise<Array<UserProfile>>;
    getAllWalletTransactions(): Promise<Array<WalletTransaction>>;
    /**
     * / Returns the caller's user profile.
     */
    getCallerUserProfile(): Promise<UserProfile>;
    getCallerUserRole(): Promise<UserRole>;
    getMatches(): Promise<Array<Match>>;
    getPendingPayments(): Promise<Array<WalletTransaction>>;
    getUserProfile(user: Principal): Promise<UserProfile>;
    getUserProfileByUsername(username: string): Promise<UserProfile>;
    getUsersSortedByWallet(): Promise<Array<UserProfile>>;
    getWalletBalance(): Promise<bigint>;
    getWithdrawals(): Promise<Array<WalletTransaction>>;
    hasUserTransaction(user: Principal, transactionType: Variant_deposit_withdrawal): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    isRegistered(user: Principal): Promise<boolean>;
    joinMatch(): Promise<void>;
    /**
     * / Returns true if the input password matches the user's password.
     */
    login(password: string): Promise<boolean>;
    /**
     * / Registers a new user profile with the provided username and password.
     */
    register(username: string, password: string): Promise<void>;
    requestWithdraw(amount: bigint): Promise<void>;
    /**
     * / Saves the user profile for the caller.
     */
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    submitPayment(amount: bigint): Promise<void>;
    updateWalletTransactionStatus(transactionId: bigint): Promise<void>;
}

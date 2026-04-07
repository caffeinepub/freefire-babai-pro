import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Clan {
    id: string;
    members: Array<string>;
    leaderId: string;
    name: string;
    createdAt: bigint;
}
export interface UserPublic {
    uid: string;
    lastLoginDate: string;
    referralCode: string;
    fcmToken: string;
    lastLoginAt: bigint;
    loginStreak: bigint;
    kycVerified: boolean;
    name: string;
    createdAt: bigint;
    coins: bigint;
    totalWins: bigint;
    loyaltyPoints: bigint;
    banReason: string;
    referredBy: string;
    birthMonth: bigint;
    isBanned: boolean;
    isAdmin: boolean;
    vipTier: string;
    totalKills: bigint;
    walletBalance: number;
    totalMatchesPlayed: bigint;
}
export interface Tournament {
    id: string;
    startTime: bigint;
    status: string;
    registeredPlayers: Array<string>;
    name: string;
    createdAt: bigint;
    winner: string;
    entryFee: number;
    prizePool: number;
}
export interface Message {
    id: string;
    createdAt: bigint;
    text: string;
    imageUrl: string;
    senderName: string;
    category: string;
    isPinned: boolean;
    reactions: Array<[string, string]>;
    senderId: string;
}
export interface Match {
    id: string;
    status: string;
    title: string;
    voiceChannelLink: string;
    scheduledTime: string;
    mode: string;
    createdAt: bigint;
    winner: string;
    perKill: number;
    roomPassword: string;
    currentPlayers: bigint;
    isHidden: boolean;
    entryFee: number;
    joinedPlayers: Array<[string, string]>;
    roomId: string;
    kills: Array<[string, bigint]>;
    maxPlayers: bigint;
    prizePool: number;
    adminProfit: number;
}
export interface UserAdmin {
    uid: string;
    lastLoginDate: string;
    referralCode: string;
    lastLoginAt: bigint;
    loginStreak: bigint;
    kycVerified: boolean;
    name: string;
    createdAt: bigint;
    coins: bigint;
    totalWins: bigint;
    loyaltyPoints: bigint;
    banReason: string;
    referredBy: string;
    birthMonth: bigint;
    isBanned: boolean;
    isAdmin: boolean;
    phone: string;
    vipTier: string;
    totalKills: bigint;
    walletBalance: number;
    totalMatchesPlayed: bigint;
}
export interface Report {
    id: string;
    createdAt: bigint;
    reportedId: string;
    reporterId: string;
    reason: string;
}
export interface Transaction {
    id: string;
    uid: string;
    status: string;
    note: string;
    createdAt: bigint;
    coins: bigint;
    upiId: string;
    txType: string;
    amount: number;
}
export interface backendInterface {
    adminAdjustCoins(adminUid: string, targetUid: string, coins: bigint): Promise<void>;
    adminAdjustWallet(adminUid: string, targetUid: string, amount: number, note: string): Promise<void>;
    adminAssignKills(adminUid: string, matchId: string, killData: Array<[string, bigint]>): Promise<void>;
    adminBanUser(adminUid: string, targetUid: string, reason: string): Promise<void>;
    adminCreateMatch(adminUid: string, mode: string, title: string, entryFee: number, prizePool: number, perKill: number, maxPlayers: bigint, scheduledTime: string): Promise<string>;
    adminCreateTournament(adminUid: string, name: string, entryFee: number, prizePool: number, startTime: bigint): Promise<string>;
    adminDeclareTournamentWinner(adminUid: string, tournamentId: string, winnerUid: string): Promise<void>;
    adminDeclareWinner(adminUid: string, matchId: string, winnerUid: string): Promise<void>;
    adminGetAllMatches(adminUid: string): Promise<Array<Match>>;
    adminGetAllTransactions(adminUid: string): Promise<Array<Transaction>>;
    adminGetAllUsers(adminUid: string): Promise<Array<UserAdmin>>;
    adminGetReports(adminUid: string): Promise<Array<Report>>;
    adminGetRevenue(adminUid: string): Promise<{
        totalCollected: number;
        totalWithdrawals: number;
        totalPrizesPaid: number;
        totalDeposits: number;
        netProfit: number;
    }>;
    adminPinMessage(adminUid: string, msgId: string, pin: boolean): Promise<void>;
    adminSendMessage(adminUid: string, text: string, category: string, imageUrl: string, isPinned: boolean): Promise<string>;
    adminSetKyc(adminUid: string, targetUid: string, verified: boolean): Promise<void>;
    adminSetMatchRoom(adminUid: string, matchId: string, roomId: string, roomPassword: string): Promise<void>;
    adminSetVoiceLink(adminUid: string, matchId: string, link: string): Promise<void>;
    adminToggleMatchVisibility(adminUid: string, matchId: string): Promise<void>;
    adminUnbanUser(adminUid: string, targetUid: string): Promise<void>;
    adminUpdateMatchStatus(adminUid: string, matchId: string, status: string): Promise<void>;
    adminUpdateTransaction(adminUid: string, txId: string, status: string): Promise<void>;
    createClan(uid: string, name: string): Promise<string>;
    getClans(): Promise<Array<Clan>>;
    getLeaderboard(): Promise<Array<UserPublic>>;
    getMatch(matchId: string): Promise<Match | null>;
    getMatches(): Promise<Array<Match>>;
    getMessages(): Promise<Array<Message>>;
    getMyProfile(uid: string): Promise<UserPublic | null>;
    getTournaments(): Promise<Array<Tournament>>;
    getUserTransactions(uid: string): Promise<Array<Transaction>>;
    joinClan(uid: string, clanId: string): Promise<string>;
    joinMatch(uid: string, matchId: string): Promise<string>;
    login(uid: string, password: string): Promise<[UserPublic | null, string]>;
    reactToMessage(uid: string, msgId: string, emoji: string): Promise<void>;
    registerForTournament(uid: string, tournamentId: string): Promise<string>;
    registerUser(uid: string, password: string, name: string, phone: string, referredBy: string): Promise<string>;
    reportPlayer(reporterId: string, reportedId: string, reason: string): Promise<void>;
    submitDeposit(uid: string, amount: number, upiId: string): Promise<string>;
    submitWithdrawal(uid: string, amount: number, upiId: string): Promise<string>;
    updateFcmToken(uid: string, token: string): Promise<void>;
    updateProfile(uid: string, name: string, phone: string, birthMonth: bigint): Promise<void>;
}

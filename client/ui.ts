import { Ctx } from "boardgame.io";
import { Client } from "boardgame.io/dist/types/packages/client";
import {
    getMinimumBid,
    IEmuBayState,
    actions,
    ACTION_CUBE_LOCATION_ACTIONS,
    IBond,
    BuildMode,
    ICoordinates,
    getMergableCompanies,
    CompanyType,
    stalemateAvailable,
    getAllowedBuildSpaces,
    getTakeResourceSpaces,
    EndGameReason,
    IEndgameState,
    activeEndGameConditions,
    PseudoStage,
    PseudoPhase,
} from "../game/game";
import { Board } from "../client/board";
import { EmuBayRailwayCompanyClient } from "./app";
import { State } from "pixi.js";

var grid = document.querySelector("#maingrid")!;

const COMPANY_ABBREV = ["EBR", "TMLC", "LW", "GT", "MLM", "NED", "NMF"];
const COMPANY_NAME = [
    "Emu Bay Railway Co.",
    "Tasmanian Main Line Railroad",
    "Launceston & Western",
    "Grubb's Tramway - 1",
    "Mount Lyell Mining and Railway Co. - 2",
    "North East Dundas Tramway - 3",
    "North Mount Farrell - 4",
];
const ACTIONS = [
    "Build track",
    "Auction Share",
    "Take Resource",
    "Issue Bond",
    "Merge Private",
    "Pay Dividend",
];
const END_GAME_REASON_TEXT = [
    "Player quit. ",
    "Stalemate. There were no legal actions available. ",
    "Bankruptcy. ",
    "All non-reserved shares sold. ",
    "2 or fewer remaining bonds. ",
    "3 of 4 charters have no remaining track. ",
    "3 or fewer resources remaining on board. ",
];

export class Ui {
    public constructor(client: EmuBayRailwayCompanyClient) {
        this.client = client;
    }

    private client: EmuBayRailwayCompanyClient;
    private buildMode: BuildMode = BuildMode.Normal;

    private static formatCash(cash: number): string {
        return `${cash < 0 ? "-" : ""}₤${Math.abs(cash)}`;
    }

    private static PlayersFromMatch(match: any, ctx: Ctx): string[] {
        let returns: string[] = [];
        if (match) {
            let idx = 0;
            for (var key in match) {
                ++idx;
                if (match[key].name) {
                    returns.push(match[key].name);
                } else {
                    returns.push(`Player ${idx}`);
                }
            }
        } else {
            for (var i = 0; i < ctx.numPlayers; ++i) {
                returns.push(`Player ${i + 1}`);
            }
        }
        return returns;
    }

    private playerNames: string[] = [];
    private playerIsActive: boolean = true;

    public update(
        gamestate: IEmuBayState,
        ctx: Ctx,
        client: any,
        board: Board,
        isCurrent: Boolean,
        visibleTurnId: number
    ): void {
        // Reset this on update, will set correctly during update
        board.tileClickedOn = undefined;

        this.playerNames = Ui.PlayersFromMatch(client.matchData, ctx);
        // isCurrent is whether we're current in the match (as opposed to browsing back or forwards)
        this.playerIsActive =
            isCurrent &&
            (!client.playerID || client.playerID == +ctx.currentPlayer);

        // Action selector
        {
            let contentDiv = document.querySelector(`#actions .card .content`);

            contentDiv!.innerHTML = "";
            let statusDiv = document.createElement("div");
            statusDiv.classList.add("actionStatus");
            contentDiv?.appendChild(statusDiv);

            let actionsDiv = document.createElement("div");
            actionsDiv.classList.add("actioncontainer");
            contentDiv?.appendChild(actionsDiv);

            let stage = gamestate.pseudoStage;

            switch (stage) {
                case PseudoStage.takeAction:
                    statusDiv.innerText = "Choose an action";
                    break;
                case PseudoStage.removeCube:
                    statusDiv.innerText = "Remove a cube";
                    break;
            }

            if (
                stage == PseudoStage.removeCube &&
                stalemateAvailable(gamestate, ctx)
            ) {
                let stalemateDiv = document.createElement("div");
                stalemateDiv.innerText = "Declare Stalemate";
                if (this.playerIsActive)
                    stalemateDiv.classList.add("chooseableaction");
                stalemateDiv.classList.add("endgameable");
                stalemateDiv.onclick = (ev) => client.moves.declareStalemate();
                contentDiv?.appendChild(stalemateDiv);
            }

            {
                let actionDiv = document.createElement("div");
                actionDiv.innerText = "Review";
                actionDiv.classList.add("actionbox");
                actionsDiv?.appendChild(actionDiv);

                let row1 = document.createElement("p");
                actionDiv.appendChild(row1);

                let startSpan = document.createElement("span");
                startSpan.innerText = "Start";
                startSpan.id = "StartSpan";
                startSpan.classList.add("smallerchooseable");
                row1.appendChild(startSpan);
                if (visibleTurnId != 0) {
                    startSpan.classList.add("chooseablenonaction");
                    startSpan.onclick = (e) => {
                        this.client.JumpToStart();
                    };
                }

                let backSpan = document.createElement("span");
                backSpan.innerText = "Back";
                backSpan.id = "BackSpan";
                backSpan.classList.add("smallerchooseable");
                row1.appendChild(backSpan);
                if (visibleTurnId != 0) {
                    backSpan.classList.add("chooseablenonaction");
                    backSpan.onclick = (e) => {
                        this.client.StepBack();
                    };
                }

                let nextSpan = document.createElement("span");
                nextSpan.innerText = "Next";
                nextSpan.id = "NextSpan";
                nextSpan.classList.add("smallerchooseable");
                row1.appendChild(nextSpan);
                if (!isCurrent) {
                    nextSpan.classList.add("chooseablenonaction");
                    nextSpan.onclick = (e) => {
                        this.client.StepForward();
                    };
                }

                let currentSpan = document.createElement("span");
                currentSpan.innerText = "Now";
                currentSpan.id = "CurrentSpan";
                currentSpan.classList.add("smallerchooseable");
                row1.appendChild(currentSpan);
                if (!isCurrent) {
                    currentSpan.classList.add("chooseablenonaction");
                    currentSpan.onclick = (e) => {
                        this.client.SkipToCurrent();
                    };
                }
            }

            ACTIONS.forEach((actionName, idx) => {
                let actionDiv = document.createElement("div");
                actionDiv.innerText = actionName;
                actionDiv.classList.add("actionbox");

                let availableSpaceCount = ACTION_CUBE_LOCATION_ACTIONS.map(
                    (v, i) => ({ value: v, idx: i })
                )
                    .filter((v) => v.value == idx)
                    .filter(
                        (v) => gamestate.actionCubeLocations[v.idx] == false
                    ).length;

                let filledSpaceCount = ACTION_CUBE_LOCATION_ACTIONS.map(
                    (v, i) => ({ value: v, idx: i })
                )
                    .filter((v) => v.value == idx)
                    .filter(
                        (v) => gamestate.actionCubeLocations[v.idx] == true
                    ).length;

                let spacesP = document.createElement("p");
                spacesP.classList.add("actioncubes");
                spacesP.innerText =
                    "□".repeat(availableSpaceCount) +
                    "■".repeat(filledSpaceCount);
                actionDiv?.appendChild(spacesP);

                actionDiv!.dataset.actionid = idx.toString();
                if (this.playerIsActive) {
                    actionDiv!.onclick = (ev) => {
                        if (
                            !(
                                ev.currentTarget as HTMLElement
                            ).classList.contains("chooseableaction")
                        ) {
                            return;
                        }
                        if (stage == PseudoStage.removeCube) {
                            client.moves.removeCube(
                                +(ev.currentTarget as HTMLDivElement)!.dataset!
                                    .actionid!
                            );
                        }

                        if (stage == PseudoStage.takeAction) {
                            switch (
                                +(ev.currentTarget as HTMLDivElement)!.dataset!
                                    .actionid!
                            ) {
                                case actions.AuctionShare:
                                    this.clearActionExtras();
                                    contentDiv?.appendChild(
                                        this.auctionShareExtra(
                                            gamestate,
                                            ctx,
                                            client
                                        )
                                    );
                                    break;
                                case actions.BuildTrack:
                                    this.clearActionExtras();
                                    contentDiv?.appendChild(
                                        this.buildTrackExtra(
                                            gamestate,
                                            ctx,
                                            client
                                        )
                                    );
                                    break;
                                case actions.IssueBond:
                                    this.clearActionExtras();
                                    contentDiv?.appendChild(
                                        this.issueBondExtra(
                                            gamestate,
                                            ctx,
                                            client
                                        )
                                    );
                                    break;
                                case actions.Merge:
                                    this.clearActionExtras();
                                    contentDiv?.appendChild(
                                        this.mergeExtra(gamestate, ctx, client)
                                    );
                                    break;
                                case actions.TakeResources:
                                    this.clearActionExtras();
                                    contentDiv?.appendChild(
                                        this.takeResourcesExtra(
                                            gamestate,
                                            ctx,
                                            client
                                        )
                                    );
                                    break;
                                case actions.PayDividend:
                                    this.clearActionExtras();
                                    client.moves.payDividends();
                            }
                        }
                    };
                }

                if (stage == PseudoStage.removeCube) {
                    if (filledSpaceCount > 0) {
                        if (this.playerIsActive)
                            actionDiv.classList.add("chooseableaction");
                    }
                }

                if (stage == PseudoStage.takeAction) {
                    if (
                        availableSpaceCount > 0 &&
                        idx != gamestate.actionCubeTakenFrom
                    ) {
                        if (this.playerIsActive)
                            actionDiv.classList.add("chooseableaction");
                    }
                }

                actionsDiv?.appendChild(actionDiv);
            });

            {
                let undoDiv = document.createElement("div");
                undoDiv.innerText = "Undo";
                undoDiv.classList.add("actionbox");
                if (ctx?.numMoves ?? 0 > 0) {
                    if (this.playerIsActive)
                        undoDiv.classList.add("chooseableaction");
                    undoDiv.onclick = (ev) => {
                        client.undo();
                    };
                }
                actionsDiv?.appendChild(undoDiv);
            }

            if (ctx.gameover) {
                contentDiv?.append(this.gameOverPhase(gamestate, ctx));
            }

            if (stage == PseudoStage.buildingTrack) {
                board.tileClickedOn = (xy) => {
                    client.moves.buildTrack(xy, this.buildMode);
                };
                contentDiv?.append(
                    this.buildTrackStage(gamestate, ctx, client, board)
                );
            }

            if (stage == PseudoStage.takeResources) {
                board.tileClickedOn = (xy) => {
                    client.moves.takeResource(xy);
                };
                contentDiv?.append(
                    this.takeResourcesStage(gamestate, ctx, client)
                );
            }

            let phase = gamestate.pseudoPhase;
            if (
                phase == PseudoPhase.Auction ||
                phase == PseudoPhase.InitialAuction
            ) {
                let auctionH1 = document.createElement("h1");
                auctionH1.innerText = "Auction";
                contentDiv?.append(auctionH1);

                let auctionH2 = document.createElement("h2");
                auctionH2.innerText = `Auctioning ${
                    COMPANY_NAME[gamestate.companyForAuction!]
                }`;
                auctionH2.classList.add(
                    COMPANY_ABBREV[gamestate.companyForAuction!]
                );
                contentDiv?.append(auctionH2);

                let playerCash = gamestate.players[+ctx.currentPlayer].cash;

                let playerH2 = document.createElement("h2");
                playerH2.innerText = `${
                    this.playerNames[+ctx.currentPlayer]
                } (${Ui.formatCash(playerCash)})`;
                contentDiv?.append(playerH2);

                let statusP = document.createElement("p");
                let statusText = "";
                if (gamestate.currentBid == 0) {
                    statusText = "No bids";
                } else {
                    statusText = `${
                        this.playerNames[gamestate.winningBidder!]
                    } winning on ₤${gamestate.currentBid}`;
                }

                statusP.innerText = statusText;

                // Can only pass during initial auction, or if you're not required to make initial bid
                if (
                    phase == PseudoPhase.InitialAuction ||
                    (phase == PseudoPhase.Auction && gamestate.currentBid! > 0)
                ) {
                    let passP = document.createElement("p");
                    passP.innerText = "Pass";
                    if (this.playerIsActive)
                        passP.classList.add("chooseableaction");
                    passP.onclick = (pass_ev) => {
                        client.moves.pass();
                    };
                    contentDiv?.appendChild(passP);
                }

                let minBid = Math.max(
                    getMinimumBid(gamestate, gamestate.companyForAuction!),
                    gamestate.currentBid! + 1
                );
                if (playerCash >= minBid) {
                    let bidsP = document.createElement("p");
                    bidsP.innerText = "Bid: ";
                    for (let bid = minBid; bid <= playerCash; ++bid) {
                        let bidS = document.createElement("span");
                        bidS.innerText = bid.toString();
                        if (this.playerIsActive)
                            bidS.classList.add("chooseableaction");
                        bidS.classList.add("bid");
                        bidS.dataset.bid = bid.toString();
                        bidS.onclick = (bidS_ev) => {
                            client.moves.makeBid(
                                +(bidS_ev.currentTarget as HTMLElement)!.dataset
                                    .bid!
                            );
                        };
                        bidsP.appendChild(bidS);
                    }
                    contentDiv?.appendChild(bidsP);
                }

                contentDiv?.append(statusP);
            }
        }

        let playerRow = document.querySelector(`#playerData`);

        // Player states
        gamestate.players.forEach((player, idx) => {
            let outerDiv = document.querySelector(`#player${idx}`);
            let contentDiv = document.querySelector(
                `#player${idx} .card .content`
            );
            let cardDiv = document.querySelector(`#player${idx} .card`);
            if (!outerDiv) {
                outerDiv = document.createElement("div");
                outerDiv.id = `player${idx}`;
                document.querySelector("#maingrid")?.appendChild(outerDiv);

                cardDiv = document.createElement("div");
                outerDiv.appendChild(cardDiv);
                cardDiv.classList.add("card");

                let playerName = document.createElement("h1");
                playerName.innerText = this.playerNames[idx];
                cardDiv.appendChild(playerName);

                contentDiv = document.createElement("div");
                cardDiv.appendChild(contentDiv);
                contentDiv.classList.add("content");

                playerRow!.appendChild(outerDiv);
            }

            if (idx == +ctx.currentPlayer) {
                cardDiv?.classList.add("currentplayer");
            } else {
                cardDiv?.classList.remove("currentplayer");
            }

            // So, we do the item thing, but these are just going to delete and replace
            // items
            contentDiv!.innerHTML = "";

            let cashP = document.createElement("p");
            cashP.innerText = `Cash ${Ui.formatCash(player.cash)}`;
            cashP.classList.add("cash");
            contentDiv?.appendChild(cashP);

            gamestate.companies.forEach((co, coidx) => {
                var held = co.sharesHeld.filter(
                    (holder) => holder == idx
                ).length;
                if (held == 0) {
                    return;
                }
                var shareText: string;
                if (held == 1) {
                    shareText = COMPANY_ABBREV[coidx];
                } else {
                    shareText = `${held} × ${COMPANY_ABBREV[coidx]}`;
                }

                let shareP = document.createElement("p");
                shareP.innerText = shareText;
                shareP.classList.add(`${COMPANY_ABBREV[coidx]}`);
                contentDiv?.appendChild(shareP);
            });
        });

        let coRow = document.querySelector(`#companyData`);
        if (!coRow) {
            coRow = document.createElement("div");
            coRow.id = `companyData`;
            coRow.classList.add("row");
        }

        gamestate.companies.forEach((co, idx) => {
            let outerDiv = document.querySelector(`#company${idx}`);
            let contentDiv = document.querySelector(
                `#company${idx} .card .content`
            );
            let cardDiv = document.querySelector(`#company${idx} .card`);
            let nextInd = false;
            if (co.companyType == CompanyType.Minor && !co.open) {
                if (
                    gamestate.companies.some((ownerco) =>
                        ownerco.independentsOwned.includes(co)
                    )
                ) {
                    // Merged independent
                    return;
                }
                nextInd = gamestate.independentOrder[0] == co.id;
            }
            if (!outerDiv) {
                outerDiv = document.createElement("div");
                outerDiv.id = `company${idx}`;
                outerDiv.classList.add("companyCard");
                document.querySelector("#maingrid")?.appendChild(outerDiv);
                outerDiv.classList.add("item");
                outerDiv.classList.add("two", "columns");

                cardDiv = document.createElement("div");
                outerDiv.appendChild(cardDiv);
                cardDiv.classList.add("card");

                let coName = document.createElement("h1");
                coName.innerText = `${COMPANY_ABBREV[idx]}`;
                coName.classList.add(`${COMPANY_ABBREV[idx]}`);
                cardDiv.appendChild(coName);

                if (!co.open) {
                    let startedText = document.createElement("div");
                    startedText.innerText = `Not Started Yet`;
                    cardDiv.appendChild(startedText);
                }
                if (nextInd) {
                    let nextText = document.createElement("div");
                    nextText.innerText = "Next to be started";
                    cardDiv.appendChild(nextText);
                }

                contentDiv = document.createElement("div");
                cardDiv.appendChild(contentDiv);
                contentDiv.classList.add("content");

                coRow!.appendChild(outerDiv);
            }

            contentDiv!.innerHTML = "";
            let cashP = document.createElement("p");
            cashP.innerText = `${Ui.formatCash(
                co.cash
            )} (Rev ${Ui.formatCash(co.currentRevenue)})`;
            cashP.classList.add("cash");
            contentDiv?.appendChild(cashP);

            if (co.independentsOwned.length != 0) {
                let indP = document.createElement("p");
                indP.innerHTML =
                    "Owns " +
                    co.independentsOwned
                        .map((i) => COMPANY_ABBREV[i.id])
                        .join(", ");
                contentDiv?.appendChild(indP);
            }

            if (co.sharesHeld.length != 0) {
                let revsplitP = document.createElement("p");
                revsplitP.innerText += ` (${Ui.formatCash(
                    Math.ceil(
                        Math.abs(co.currentRevenue) / co.sharesHeld.length
                    )
                )} / share)`;
                contentDiv?.appendChild(revsplitP);
            }

            if (
                co.trainsRemaining > 0 ||
                co.narrowGaugeRemaining > 0 ||
                co.resourcesHeld > 0
            ) {
                let trainsP = document.createElement("p");
                let ordinary = document.createElement("span");
                ordinary.innerText = "■".repeat(co.trainsRemaining);
                ordinary.classList.add(`${COMPANY_ABBREV[idx]}`);
                ordinary.classList.add("cube");
                trainsP.appendChild(ordinary);
                let narrow = document.createElement("span");
                narrow.classList.add("ng");
                narrow.classList.add("cube");
                narrow.innerText = "■".repeat(co.narrowGaugeRemaining);
                trainsP.appendChild(narrow);
                let resources = document.createElement("span");
                resources.classList.add("resource");
                resources.innerText = "⬣".repeat(co.resourcesHeld);
                trainsP.appendChild(resources);
                contentDiv?.append(trainsP);
            }

            let sharesRemainingText = `Shares: ${co.sharesRemaining}/${co.sharesRemaining + co.sharesHeld.length}`;
            if (co.reservedSharesRemaining > 0) {
                sharesRemainingText += ` (${co.reservedSharesRemaining} rsvd)`;
            }
            let srP = document.createElement("p");
            srP.innerText = sharesRemainingText;
            contentDiv?.appendChild(srP);

            if (co.bonds.length > 0) {
                let bondsP = document.createElement("p");
                bondsP.innerText = `Bonds: `;
                contentDiv?.append(bondsP);

                co.bonds.forEach((i) => {
                    let bondS = document.createElement("span");
                    bondS.innerText = this.bondToString(i);
                    bondsP?.append(bondS);
                });
            }
        });

        let infoRow = document.querySelector(`#infoRow`);
        // Bonds
        {
            let outerDiv = document.querySelector(`#bonds`);
            let contentDiv = document.querySelector(`#bonds .card .content`);
            let cardDiv = document.querySelector(`#bonds .card`);
            if (!outerDiv) {
                outerDiv = document.createElement("div");
                outerDiv.id = `bonds`;
                document.querySelector("#maingrid")?.appendChild(outerDiv);

                cardDiv = document.createElement("div");
                outerDiv.appendChild(cardDiv);
                cardDiv.classList.add("card");

                let h = document.createElement("h1");
                h.innerText = `Bonds Remaining`;
                cardDiv.appendChild(h);

                contentDiv = document.createElement("div");
                cardDiv.appendChild(contentDiv);
                contentDiv.classList.add("content");

                infoRow!.appendChild(outerDiv);
            }

            contentDiv!.innerHTML = "";

            gamestate.bonds.forEach((i) => {
                let bondP = document.createElement("p");
                bondP.innerText = this.bondToString(i, false);
                contentDiv?.appendChild(bondP);
            });
        }

        // Endgame tracker
        {
            let outerDiv = document.querySelector(`#endgame`);
            let contentDiv = document.querySelector(`#endgame .card .content`);
            let cardDiv = document.querySelector(`#endgame .card`);
            if (!outerDiv) {
                outerDiv = document.createElement("div");
                outerDiv.id = `endgame`;
                document.querySelector("#maingrid")?.appendChild(outerDiv);

                cardDiv = document.createElement("div");
                outerDiv.appendChild(cardDiv);
                cardDiv.classList.add("card");

                let h = document.createElement("h1");
                h.innerText = `Endgame Conditions`;
                cardDiv.appendChild(h);

                contentDiv = document.createElement("div");
                cardDiv.appendChild(contentDiv);
                contentDiv.classList.add("content");

                infoRow!.appendChild(outerDiv);
            }

            contentDiv!.innerHTML = "";

            let descriptionP = document.createElement("p");
            descriptionP.innerText =
                "When 2 of these conditions are met, the game will end after dividends are next paid out.";
            contentDiv?.appendChild(descriptionP);

            let conditionsUl = document.createElement("ul");
            contentDiv?.appendChild(conditionsUl);

            let activeConditions = activeEndGameConditions(gamestate);

            END_GAME_REASON_TEXT.slice(3).forEach((i, idx) => {
                let conditionLi = document.createElement("li");
                conditionLi.innerText = i;
                if (activeConditions.includes(idx + 3)) {
                    conditionLi.classList.add("activecondition");
                }
                conditionsUl.appendChild(conditionLi);
            });
        }
    }

    // Clear the additional 'extra data' selector things from actions
    private clearActionExtras() {
        document
            .querySelectorAll(`#actions .card .content .actionextra`)
            ?.forEach((i) => i.remove());
    }

    private auctionShareExtra(
        gamestate: IEmuBayState,
        ctx: Ctx,
        client: any
    ): HTMLElement {
        let auctionExtraDiv = document.createElement("div");
        auctionExtraDiv.classList.add("actionextra");

        let toList = gamestate.companies
            .map((v, i) => ({ value: v, idx: i }))
            .filter((c) => {
                // If a public company, or private but next, and share available - list
                if (
                    getMinimumBid(gamestate, c.idx) >
                    gamestate.players[+ctx.currentPlayer].cash
                ) {
                    return false;
                }
                if (c.value.sharesRemaining == 0) {
                    return false;
                }
                if (
                    c.value.companyType == CompanyType.Minor &&
                    (gamestate.independentOrder.length == 0 ||
                        c.idx != gamestate.independentOrder[0])
                ) {
                    return false;
                }
                return true;
            });
        let dirH1 = document.createElement("h1");
        dirH1.innerText = "Pick a company to auction";
        auctionExtraDiv.appendChild(dirH1);
        if (toList.length == 0) {
            let warningP = document.createElement("p");
            warningP.innerText = "No shares available";
            auctionExtraDiv.appendChild(warningP);
        } else {
            toList.forEach((i) => {
                let coP = document.createElement("p");
                coP.classList.add(COMPANY_ABBREV[i.idx]);
                if (this.playerIsActive) coP.classList.add("chooseableaction");
                coP.innerText = COMPANY_NAME[i.idx];
                coP.dataset.co = i.idx.toString();
                coP.onclick = (cop_ev) => {
                    client.moves.auctionShare(
                        +(cop_ev.currentTarget as HTMLElement)!.dataset!.co!
                    );
                };
                auctionExtraDiv.appendChild(coP);
            });
        }
        return auctionExtraDiv;
    }

    private issueBondExtra(
        gamestate: IEmuBayState,
        ctx: Ctx,
        client: any
    ): HTMLElement {
        let issueBondExtraDiv = document.createElement("div");
        issueBondExtraDiv.classList.add("actionextra");

        let available = gamestate.companies
            .map((v, i) => ({ value: v, idx: i }))
            .filter((c) => {
                // Have to have share, has to not be private
                if (c.idx >= 3) {
                    return false;
                }
                if (
                    c.value.sharesHeld.filter(
                        (player) => player == +ctx.currentPlayer
                    ).length > 0
                ) {
                    return true;
                }
                return false;
            });
        let dirH1 = document.createElement("h1");
        dirH1.innerText = "Pick a company to issue";
        issueBondExtraDiv.appendChild(dirH1);
        if (gamestate.bonds.length == 0) {
            let warningP = document.createElement("p");
            warningP.innerText = "No bonds remaining";
            issueBondExtraDiv.appendChild(warningP);
        } else {
            available.forEach((i) => {
                let coP = document.createElement("p");
                coP.classList.add(COMPANY_ABBREV[i.idx]);
                if (this.playerIsActive) coP.classList.add("chooseableaction");
                coP.classList.add("coToChoose");
                coP.innerText = COMPANY_NAME[i.idx];
                coP.dataset.co = i.idx.toString();
                coP.onclick = (cop_ev) => {
                    let element = cop_ev.currentTarget as HTMLElement;
                    let co = +element!.dataset!.co!;
                    document
                        .querySelectorAll(`.coToChoose:not([data-co="${co}"])`)
                        .forEach((i) => (i as HTMLElement).remove());
                    element.classList.remove("chooseableaction");
                    element.onclick = null;
                    issueBondExtraDiv.appendChild(
                        this.issueBondExtra2(gamestate, ctx, client, co)
                    );
                };
                issueBondExtraDiv.appendChild(coP);
            });
        }

        return issueBondExtraDiv;
    }

    private issueBondExtra2(
        gamestate: IEmuBayState,
        ctx: Ctx,
        client: any,
        company: number
    ): HTMLElement {
        let issueBondExtraDiv = document.createElement("div");
        issueBondExtraDiv.classList.add("actionextra");
        let dirH1 = document.createElement("h1");
        dirH1.innerText = "Pick a bond to issue";
        issueBondExtraDiv.appendChild(dirH1);
        let bondsP = document.createElement("p");
        gamestate.bonds.forEach((bond, idx) => {
            let bondS = document.createElement("span");
            if (this.playerIsActive) bondS.classList.add("chooseableaction");
            bondS.innerText = this.bondToString(bond, false);
            bondS.dataset!.bondId = idx.toString();
            bondS.onclick = (ev) => {
                client.moves.issueBond(
                    company,
                    +(ev.currentTarget as HTMLElement)!.dataset!.bondId!
                );
            };
            bondsP.appendChild(bondS);
        });
        issueBondExtraDiv.appendChild(bondsP);

        return issueBondExtraDiv;
    }

    private bondToString(bond: IBond, held: boolean = true): string {
        if (held) {
            if (bond.deferred) {
                return `(₤${bond.baseInterest}Δ₤${bond.interestDelta})`;
            } else {
                return `₤${bond.baseInterest}Δ₤${bond.interestDelta}`;
            }
        } else {
            return `₤${bond.amount!} (₤${bond.baseInterest}Δ₤${
                bond.interestDelta
            }/div)`;
        }
    }

    private buildTrackExtra(
        gamestate: IEmuBayState,
        ctx: Ctx,
        client: any
    ): HTMLElement {
        let buildTrackExtraDiv = document.createElement("div");
        buildTrackExtraDiv.classList.add("actionextra");

        let available = gamestate.companies
            .map((v, i) => ({ value: v, idx: i }))
            .filter((c) => {
                if (
                    c.value.trainsRemaining == 0 &&
                    c.value.narrowGaugeRemaining == 0
                ) {
                    return false;
                }
                if (
                    getAllowedBuildSpaces(gamestate, BuildMode.Narrow, c.idx)
                        .length +
                        getAllowedBuildSpaces(
                            gamestate,
                            BuildMode.Normal,
                            c.idx
                        ).length ==
                    0
                ) {
                    return false;
                }
                if (
                    c.value.sharesHeld.filter(
                        (player) => player == +ctx.currentPlayer
                    ).length > 0
                ) {
                    return true;
                }
                return false;
            });
        let dirH1 = document.createElement("h1");
        dirH1.innerText = "Pick a company to issue";
        buildTrackExtraDiv.appendChild(dirH1);
        available.forEach((i) => {
            let coP = document.createElement("p");
            coP.classList.add(COMPANY_ABBREV[i.idx]);
            if (this.playerIsActive) coP.classList.add("chooseableaction");
            coP.classList.add("coToChoose");
            coP.innerText = COMPANY_NAME[i.idx];
            coP.dataset.co = i.idx.toString();
            coP.onclick = (cop_ev) => {
                let element = cop_ev.currentTarget as HTMLElement;
                let co = +element!.dataset!.co!;
                if (gamestate.companies[co].trainsRemaining > 0) {
                    this.buildMode = BuildMode.Normal;
                } else {
                    this.buildMode = BuildMode.Narrow;
                }
                client.moves.buildTrackAction(
                    +(cop_ev.currentTarget as HTMLElement)!.dataset!.co!
                );
            };
            buildTrackExtraDiv.appendChild(coP);
        });
        return buildTrackExtraDiv;
    }

    private buildTrackStage(
        gamestate: IEmuBayState,
        ctx: Ctx,
        client: any,
        board: Board
    ): HTMLElement {
        let stageDiv = document.createElement("div");
        let title = document.createElement("h1");
        title.innerText = `Building Track (${COMPANY_NAME[gamestate.toAct!]})`;
        title.classList.add(COMPANY_ABBREV[gamestate.toAct!]);
        stageDiv.append(title);

        let co = gamestate.companies[gamestate.toAct!]!;

        {
            let cashP = document.createElement("p");
            cashP.innerText = `${Ui.formatCash(co.cash)} - ${
                gamestate.buildsRemaining
            } builds remaining`;
            stageDiv?.append(cashP);
        }

        if (co.trainsRemaining > 0) {
            let trainsH = document.createElement("h3");
            trainsH.innerText =
                "Normal track" +
                (this.buildMode == BuildMode.Normal ? " (building)" : "");
            stageDiv?.appendChild(trainsH);

            let trainsP = document.createElement("p");
            trainsP.innerText = `${co.trainsRemaining} track remaining`;
            stageDiv?.append(trainsP);
            if (this.buildMode != BuildMode.Normal) {
                if (gamestate.buildsRemaining! > 0) {
                    let switchP = document.createElement("p");
                    if (this.playerIsActive)
                        switchP.classList.add("chooseableaction");
                    switchP.innerText = "Switch to normal track";
                    switchP.onclick = (ev) => {
                        board.buildMode = BuildMode.Normal;
                        this.buildMode = BuildMode.Normal;
                        // Refresh panel
                        let parent = stageDiv.parentNode;
                        parent?.removeChild(stageDiv);
                        parent?.appendChild(
                            this.buildTrackStage(gamestate, ctx, client, board)
                        );
                    };
                    stageDiv?.append(switchP);
                }
            }
        }

        if (co.narrowGaugeRemaining > 0) {
            let trainsH = document.createElement("h3");
            trainsH.innerText =
                "Narrow gauge track" +
                (this.buildMode == BuildMode.Narrow ? " (building)" : "");
            stageDiv?.appendChild(trainsH);

            let narrowP = document.createElement("p");
            narrowP.innerText = `${co.narrowGaugeRemaining} narrow gauge track remaining`;
            stageDiv?.append(narrowP);

            if (this.buildMode != BuildMode.Narrow) {
                if (gamestate.buildsRemaining! > 0) {
                    let switchP = document.createElement("p");
                    if (this.playerIsActive)
                        switchP.classList.add("chooseableaction");
                    switchP.innerText = "Switch to narrow gauge track";
                    switchP.onclick = (ev) => {
                        board.buildMode = BuildMode.Narrow;
                        this.buildMode = BuildMode.Narrow;
                        // Refresh panel
                        let parent = stageDiv.parentNode;
                        parent?.removeChild(stageDiv);
                        parent?.appendChild(
                            this.buildTrackStage(gamestate, ctx, client, board)
                        );
                    };
                    stageDiv?.append(switchP);
                }
            }
        }

        if (gamestate.anyActionsTaken) {
            let passP = document.createElement("p");
            if (this.playerIsActive) passP.classList.add("chooseableaction");
            passP.innerText = "Finish building";
            passP.onclick = (ev) => {
                client.moves.doneBuilding();
            };
            stageDiv?.append(passP);
        } else {
            let passP = document.createElement("p");
            passP.innerText = "Must build at least one track";
            stageDiv?.append(passP);
        }
        let noteP = document.createElement("p");
        noteP.innerText = "Click on map on highlighted spaces to build";
        stageDiv?.append(noteP);

        board.buildMode = this.buildMode;

        return stageDiv;
    }

    private takeResourcesExtra(
        gamestate: IEmuBayState,
        ctx: Ctx,
        client: any
    ): HTMLElement {
        let takeResourcesExtraDiv = document.createElement("div");
        takeResourcesExtraDiv.classList.add("actionextra");

        // TODO: Limit to with mineable resources and cash
        let available = gamestate.companies
            .map((v, i) => ({ value: v, idx: i }))
            .filter((c) => {
                if (
                    c.value.sharesHeld.filter(
                        (player) => player == +ctx.currentPlayer
                    ).length == 0
                ) {
                    return false;
                }
                if (getTakeResourceSpaces(gamestate, c.idx).length == 0) {
                    return false;
                }
                return true;
            });
        let dirH1 = document.createElement("h1");
        dirH1.innerText = "Pick a company to take resources";
        takeResourcesExtraDiv.appendChild(dirH1);
        available.forEach((i) => {
            let coP = document.createElement("p");
            coP.classList.add(COMPANY_ABBREV[i.idx]);
            if (this.playerIsActive) coP.classList.add("chooseableaction");
            coP.classList.add("coToChoose");
            coP.innerText = COMPANY_NAME[i.idx];
            coP.dataset.co = i.idx.toString();
            coP.onclick = (cop_ev) => {
                let element = cop_ev.currentTarget as HTMLElement;
                let co = +element!.dataset!.co!;
                client.moves.mineResource(
                    +(cop_ev.currentTarget as HTMLElement)!.dataset!.co!
                );
            };
            takeResourcesExtraDiv.appendChild(coP);
        });
        return takeResourcesExtraDiv;
    }

    private takeResourcesStage(
        gamestate: IEmuBayState,
        ctx: Ctx,
        client: any
    ): HTMLElement {
        let takeResourcesStageDiv = document.createElement("div");
        takeResourcesStageDiv.classList.add("actionextra");

        let title = document.createElement("h1");

        title.innerText = `Take resources from map (${
            COMPANY_NAME[gamestate.toAct!]
        })`;
        title.classList.add(COMPANY_ABBREV[gamestate.toAct!]);
        takeResourcesStageDiv.append(title);

        let co = gamestate.companies[gamestate.toAct!]!;

        {
            let cashP = document.createElement("p");
            cashP.innerText = `${Ui.formatCash(co.cash)}`;
            takeResourcesStageDiv?.append(cashP);
        }
        if (gamestate.anyActionsTaken) {
            let passP = document.createElement("p");
            if (this.playerIsActive) passP.classList.add("chooseableaction");
            passP.innerText = "Finish taking";
            passP.onclick = (ev) => {
                client.moves.doneTaking();
            };
            takeResourcesStageDiv?.append(passP);
        } else {
            let passP = document.createElement("p");
            passP.innerText = "Must take at least one resource";
            takeResourcesStageDiv?.append(passP);
        }
        return takeResourcesStageDiv;
    }

    private mergeExtra(
        gamestate: IEmuBayState,
        ctx: Ctx,
        client: any
    ): HTMLElement {
        let takeResourcesExtraDiv = document.createElement("div");
        takeResourcesExtraDiv.classList.add("actionextra");

        // TODO: Limit to with mineable resources and cash
        let available = getMergableCompanies(gamestate, ctx);

        let dirH1 = document.createElement("h1");
        dirH1.innerText = "Merge companies";
        takeResourcesExtraDiv.appendChild(dirH1);
        available.forEach((i) => {
            let choice = document.createElement("div");
            if (this.playerIsActive) choice.classList.add("chooseableaction");
            choice.dataset.major = i.major.toString();
            choice.dataset.minor = i.minor.toString();

            let majorP = document.createElement("p");
            majorP.classList.add(COMPANY_ABBREV[i.major]);
            majorP.innerText = COMPANY_NAME[i.major];
            choice.appendChild(majorP);

            let minorP = document.createElement("p");
            minorP.classList.add(COMPANY_ABBREV[i.minor]);
            minorP.innerText = COMPANY_NAME[i.minor];
            choice.appendChild(minorP);

            choice.onclick = (cop_ev) => {
                let element = cop_ev.currentTarget as HTMLElement;
                let major = +element!.dataset!.major!;
                let minor = +element!.dataset!.minor!;
                client.moves.merge(major, minor);
            };
            takeResourcesExtraDiv.appendChild(choice);
        });
        return takeResourcesExtraDiv;
    }

    private gameOverPhase(gamestate: IEmuBayState, ctx: Ctx) {
        let gameOverPhase = document.createElement("div");
        gameOverPhase.classList.add("actionextra");

        let dirH1 = document.createElement("h1");
        dirH1.innerText = "GAME OVER";
        gameOverPhase.appendChild(dirH1);

        let gameover: IEndgameState = ctx.gameover!;

        let winnerP = document.createElement("p");
        winnerP.classList.add("winner");
        switch (gameover.winner.length) {
            case 0:
                winnerP.innerText = "No winners! (All bankrupt)";
                break;
            case 2:
                winnerP.innerText = `Won by ${gameover.winner
                    .map((i) => this.playerNames[i])
                    .join(",")}`;
                break;
            case 1:
                winnerP.innerText = `Won by ${
                    this.playerNames[gameover.winner[0]]
                }`;
                break;
        }
        gameOverPhase.appendChild(winnerP);

        let scoresUl = document.createElement("ul");
        scoresUl.classList.add("scores");
        gameOverPhase.appendChild(scoresUl);

        gameover.scores.forEach((i) => {
            let scoreLi = document.createElement("li");
            scoreLi.innerText = `${this.playerNames[i.player]}: ${Ui.formatCash(
                i.cash
            )}`;
            scoresUl.appendChild(scoreLi);
        });

        let reasons = gameover.reasons!;

        let reasonsP = document.createElement("p");
        reasonsP.innerText = "";
        gameOverPhase.appendChild(reasonsP);

        reasonsP.innerText = reasons
            .map((i) => {
                return END_GAME_REASON_TEXT[i];
            })
            .join("");

        // Remove action selection
        document.querySelectorAll(".chooseableaction").forEach((div) => {
            div.classList.remove("chooseableaction");
        });

        return gameOverPhase;
    }

    public UpdateLog(turnNumber: number, state: IEmuBayState) {
        let logDiv = document.querySelector("#logtext")!;
        logDiv.innerHTML = "";
        let ul = document.createElement("ul");
        logDiv.append(ul);
        state.turnLog.forEach((turn) => {
            let turnText = this.GetTurnLog(turn);
            if (turnText) {
                let li = document.createElement("li");
                ul.appendChild(li);
                li.innerText = turnText.text;
                if (turnText.generated) {
                    li.classList.add("generated");
                }
            }
            logDiv.scrollTop = logDiv.scrollHeight;
        });
    }

    private GetTurnLog(logEntry: string): { text: string; generated: boolean } {
        // Simple string replacement
        // %P1 for player idx 1, and so on
        // %C1 for company idx 1, and so on
        // %A1 for action idx 1
        // May be easier with regex, but this'll do for now
        var ui = this;
        var templated = logEntry.replace(/\%(..)/g, function (s) {
            // This will be an issue with more than 9 players...
            let cls = s[1];
            let idx = s[2];
            switch (cls) {
                case "P":
                    return ui.playerNames[parseInt(idx)];
                case "C":
                    return COMPANY_NAME[parseInt(idx)];
                case "A":
                    return ACTIONS[parseInt(idx)];
                default:
                    return "ERR";
            }
        });
        let generated = false;
        if (templated.length > 0 && templated[0] == "!") {
            templated = templated.slice(1);
            generated = true;
        }
        return { text: templated, generated: generated };
    }
}

# Chess Elo Rating Calculator
An unofficial calculator for estimating Elo rating changes after a chess game.

Features
Calculates Elo rating changes
Supports both winners and draw results
Simple, responsive interface
No account or installation required
How to Use
Enter both players’ current Elo ratings.
Select the result of the game.
Choose a K-factor.
Calculate to see each player’s updated rating.
Elo Formula
The expected score for player A is:

Text
EA = 1 / (1 + 10 ^ ((RB - RA) / 400))
The updated rating is:

Text
RA' = RA + K × (SA - EA)
Where:

RA — Player A’s current rating
RB — Player B’s current rating
K — K-factor
SA — Actual score: 1 for a win, 0.5 for a draw, or 0 for a loss
Usage
Open index.html in a web browser or access the hosted GitHub Pages site.

Disclaimer
This is an unofficial chess Elo calculator and is not affiliated with FIDE or any chess organization. The calculator provides estimates and may not match the rating system used by a specific federation or platform.

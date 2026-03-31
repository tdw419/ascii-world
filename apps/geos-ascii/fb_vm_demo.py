#!/usr/bin/env python3
import time
import os
import sys

# Geometry OS - Spatial ASCII Framebuffer VM (AFIS)
# "The Screen is the Hard Drive. The Pixels are the Code."

class ASCII_VM:
    def __init__(self, width=80, height=24):
        self.width = width
        self.height = height
        self.fb = [[' ' for _ in range(width)] for _ in range(height)]
        self.ip_x = 0
        self.ip_y = 0
        self.dx = 1
        self.dy = 0
        self.stack = []
        self.registers = {}
        self.halted = False
        self.output = []
        self.string_mode = False

    def load(self, ascii_text):
        lines = ascii_text.split('\n')
        for y, line in enumerate(lines):
            if y >= self.height: break
            for x, char in enumerate(line):
                if x >= self.width: break
                self.fb[y][x] = char

    def step(self):
        if self.halted: return
        
        char = self.fb[self.ip_y][self.ip_x]
        
        if self.string_mode:
            if char == '"':
                self.string_mode = False
            else:
                self.stack.append(ord(char))
        else:
            if char == '>': self.dx, self.dy = 1, 0
            elif char == '<': self.dx, self.dy = -1, 0
            elif char == '^': self.dx, self.dy = 0, -1
            elif char == 'v': self.dx, self.dy = 0, 1
            elif '0' <= char <= '9':
                self.stack.append(int(char))
            elif char == '+':
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a + b)
            elif char == '-':
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a - b)
            elif char == '*':
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a * b)
            elif char == '/':
                b, a = self.stack.pop(), self.stack.pop()
                self.stack.append(a // b if b != 0 else 0)
            elif char == '"':
                self.string_mode = True
            elif char == '.':
                if self.stack:
                    val = self.stack.pop()
                    self.output.append(str(val))
            elif char == ',':
                if self.stack:
                    val = self.stack.pop()
                    self.output.append(chr(val))
            elif char == ':': # Duplicate
                if self.stack:
                    self.stack.append(self.stack[-1])
            elif char == '?': # Conditional skip
                val = self.stack.pop() if self.stack else 0
                if val == 0:
                    self.ip_x = (self.ip_x + self.dx) % self.width
                    self.ip_y = (self.ip_y + self.dy) % self.height
            elif char == '@':
                self.halted = True
            elif 'a' <= char <= 'z': # Store in register
                if self.stack:
                    self.registers[char] = self.stack.pop()
            elif 'A' <= char <= 'Z': # Load from register
                self.stack.append(self.registers.get(char.lower(), 0))
            elif char == '!': # Write to FB: y, x, char_code !
                if len(self.stack) >= 3:
                    y, x, code = self.stack.pop(), self.stack.pop(), self.stack.pop()
                    if 0 <= y < self.height and 0 <= x < self.width:
                        self.fb[y][x] = chr(code)
            elif char == '_': # Read from FB: y, x _ -> pushes char_code
                if len(self.stack) >= 2:
                    y, x = self.stack.pop(), self.stack.pop()
                    if 0 <= y < self.height and 0 <= x < self.width:
                        self.stack.append(ord(self.fb[y][x]))
                    else:
                        self.stack.append(0)

        # Move IP
        self.ip_x = (self.ip_x + self.dx) % self.width
        self.ip_y = (self.ip_y + self.dy) % self.height

    def display(self):
        os.system('clear')
        print("┌" + "─" * self.width + "┐")
        for y, row in enumerate(self.fb):
            line = "".join(row)
            # Highlight IP
            if y == self.ip_y:
                line = line[:self.ip_x] + "\033[7m" + line[self.ip_x] + "\033[0m" + line[self.ip_x+1:]
            print("│" + line + "│")
        print("└" + "─" * self.width + "┐")
        print(f"Stack: {self.stack}")
        print(f"Registers: {self.registers}")
        print(f"Output: {''.join(self.output)}")
        if self.halted:
            print("\n[HALTED]")

def main():
    vm = ASCII_VM(40, 10)
    
    # Example Program: Count to 9 and print, then write 'X' to (5,5)
    # 0 i (register i = 0)
    # Loop:
    #   I (push register i)
    #   . (print)
    #   I 1 + i (increment i)
    #   I 9 - (compare i-9)
    #   ? (skip next if i==9)
    #   < (jump back)
    #   @ (halt)
    
    program = [
        '0i        "Counting to 9:" ....        ',
        '                                       ',
        '  I . I 1 + i I 9 - ? < @              ',
        '                                       ',
        '  88 5 5 !                             ', # Write 'X' (88) to 5,5
        '                                       ',
        '                                       ',
        '                                       ',
        '                                       ',
        '                                       '
    ]
    
    # Let's make a real spatial loop
    # Start at 0,0
    # > moves right
    # [0i] sets i=0
    # [v] moves down to the loop
    # Loop: [I.,] [I1+i] [I9-?] [<] [@]
    
    # String pushed to stack LIFO, so reverse it for correct output
    spatial_program = """0i      "!BF olleH" ,,,,,,,,,
      v
      I , I 1 + i I 9 - ? <
                            v
                            88 5 5 ! @"""
    
    vm.load(spatial_program)
    
    while not vm.halted:
        vm.display()
        vm.step()
        time.sleep(0.1)
    
    vm.display()

if __name__ == "__main__":
    main()
